const { Text, Theme, Token, UserGameText, Sentence } = require("../models");
const { exec } = require("child_process");
const { Sequelize } = require("sequelize");
const Op = Sequelize.Op;

const getNumberOfTexts = async (req, res) => {
  try {
    const numberOfTexts = await Text.count();
    res.status(200).json({ count: numberOfTexts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// TODO faire getSmallText pour mythoTypo et mythoNo
const getSmallTextWithTokens = async (req, res) => {
  try {
    // A remettre si on ajoute la mécanique de texte déjà joué
    // const { userId, gameType } = req.params;
    const { gameType, nbToken } = req.params;
    // chercher tous les textes déjà joués par cet utilisateur pour ce type de jeu
    const userGameTexts = await UserGameText.findAll({
      where: {
        // user_id: userId,
        game_type: gameType,
      },
      attributes: ["text_id"],
    });

    // créer un tableau d'IDs de ces textes
    const playedTextIds = userGameTexts.map(
      (userGameText) => userGameText.text_id
    );

    // trouver un texte qui n'a pas encore été joué par cet utilisateur pour ce type de jeu
    let text = await Text.findOne({
      where: {
        id: { [Op.notIn]: playedTextIds },
        is_plausibility_test: false,
        is_hypothesis_specification_test: false,
        is_condition_specification_test: false,
        is_negation_specification_test: false,
        is_active: true,
      },
      attributes: [
        "id",
        // "num",
        // "id_theme",
        // "origin",
        // "is_plausibility_test",
        // "test_plausibility",
        // "is_hypothesis_specification_test",
        // "is_condition_specification_test",
        // "is_negation_specification_test",
        // "length",
      ],
      order: Sequelize.literal("RAND()"),
    });

    if (!text) {
      return res.status(404).json({ error: "No more texts to process" });
    }

    // Récupérer les phrases du texte sélectionné, triées par leur position
    let sentences = await Sentence.findAll({
      where: { text_id: text.id },
      attributes: ["id", "position"],
      order: [["position", "ASC"]],
      include: [
        {
          model: Token,
          attributes: ["id", "content", "position", "is_punctuation"],
          required: true,
        },
      ],
    });

    if (sentences.length === 0) {
      return res
        .status(404)
        .json({ error: "Text " + text.id + " has no sentences" });
    }

    // Calculer le nombre total de tokens pour chaque phrase
    let totalTokensBySentence = sentences.map(
      (sentence) => sentence.tokens.length
    );
    // Calculer le total cumulatif de tokens pour identifier les points de départ possibles
    let cumulativeTokens = totalTokensBySentence.reduce((acc, curr, i) => {
      acc.push((acc[i - 1] || 0) + curr);
      return acc;
    }, []);

    let selectedSentences = [];
    let totalTokens = 0;

    if (cumulativeTokens[cumulativeTokens.length - 1] < nbToken) {
      selectedSentences = [...sentences]; // Utiliser toutes les sentences
      totalTokens = cumulativeTokens[cumulativeTokens.length - 1]; // Total de tokens du texte
    } else {
      // Déterminer le maxStartIndex correctement sans utiliser startIndex dans le calcul
      let validStartIndexes = cumulativeTokens.findIndex(
        (cumulative) => cumulative >= nbToken
      );
      if (validStartIndexes === -1) {
        // Si aucun index valide n'est trouvé
        return res
          .status(404)
          .json({ error: "Cannot find a suitable start position" });
      }

      // Le maxStartIndex est maintenant l'index du dernier élément qui peut servir de point de départ valide
      let maxStartIndex =
        validStartIndexes < sentences.length
          ? validStartIndexes
          : sentences.length - 1;

      let startIndex = Math.floor(Math.random() * (maxStartIndex + 1));
      let startFromEnd = Math.random() < 0.5; // 50% chance de commencer par la fin

      if (startFromEnd) {
        // Sélectionner depuis la fin
        for (
          let i = sentences.length - 1;
          i >= 0 && totalTokens < nbToken;
          i--
        ) {
          selectedSentences.unshift(sentences[i]); // Ajouter au début pour conserver l'ordre
          totalTokens += sentences[i].tokens.length;
          if (totalTokens >= nbToken) break;
        }
      } else {
        // Sélectionner depuis le début (votre logique actuelle)
        for (let i = 0; i < sentences.length && totalTokens < nbToken; i++) {
          selectedSentences.push(sentences[i]);
          totalTokens += sentences[i].tokens.length;
          if (totalTokens >= nbToken) break;
        }
      }
    }

    let groupedTokens = selectedSentences.flatMap((sentence) =>
      sentence.tokens.map((token) => ({
        id: token.id,
        content: token.content,
        position: token.position,
        is_punctuation: token.is_punctuation,
      }))
    );

    // Construire le résultat final
    let result = {
      id: text.id,
      num: text.num,
      id_theme: text.id_theme,
      origin: text.origin,
      is_plausibility_test: text.is_plausibility_test,
      test_plausibility: text.test_plausibility,
      is_hypothesis_specification_test: text.is_hypothesis_specification_test,
      is_condition_specification_test: text.is_condition_specification_test,
      is_negation_specification_test: text.is_negation_specification_test,
      length: text.length,
      sentence_positions:
        selectedSentences.length === sentences.length
          ? "full"
          : selectedSentences.map((sentence) => sentence.position).join(", "),
      tokens: groupedTokens,
    };

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getTextWithTokensNotPlayed = async (req, res) => {
  try {
    const { userId, gameType } = req.params;
    // chercher tous les textes déjà joués par cet utilisateur pour ce type de jeu
    const userGameTexts = await UserGameText.findAll({
      where: {
        user_id: userId,
        game_type: gameType,
      },
      attributes: ["text_id"],
    });

    // créer un tableau d'IDs de ces textes
    const playedTextIds = userGameTexts.map(
      (userGameText) => userGameText.text_id
    );

    // trouver un texte qui n'a pas encore été joué par cet utilisateur pour ce type de jeu
    const text = await Text.findOne({
      where: {
        id: { [Op.notIn]: playedTextIds },
        is_plausibility_test: false,
        is_hypothesis_specification_test: false,
        is_condition_specification_test: false,
        is_negation_specification_test: false,
        is_active: true,
      },
      attributes: [
        "id",
        "num",
        "id_theme",
        "origin",
        "is_plausibility_test",
        "test_plausibility",
        "is_hypothesis_specification_test",
        "is_condition_specification_test",
        "is_negation_specification_test",
        "length",
      ],
      order: Sequelize.literal("RAND()"),
      include: [
        {
          model: Token,
          attributes: ["id", "content", "position", "is_punctuation"],
        },
      ],
    });

    if (!text) {
      return res.status(404).json({ error: "No more texts to process" });
    }
    text.tokens.sort((a, b) => a.position - b.position);

    res.status(200).json(text);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getTextWithTokensByGameType = async (req, res) => {
  try {
    const text = await Text.findOne({
      where: {
        is_active: true,
      },
      attributes: [
        "id",
        "num",
        "id_theme",
        "origin",
        "is_plausibility_test",
        "test_plausibility",
        "is_hypothesis_specification_test",
        "is_condition_specification_test",
        "is_negation_specification_test",
        "length",
      ],
      order: Sequelize.literal("RAND()"),
      include: [
        {
          model: Token,
          attributes: ["id", "content", "position", "is_punctuation"],
        },
      ],
    });

    if (!text) {
      return res.status(404).json({ error: "No more texts to process" });
    }
    text.tokens.sort((a, b) => a.position - b.position);

    res.status(200).json(text);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAllTexts = async (req, res) => {
  try {
    const texts = await Text.findAll();
    const truncatedTexts = texts.map((text) => {
      const content =
        text.content.length > 180
          ? text.content.substring(0, 180) + "..."
          : text.content;

      return {
        ...text.toJSON(),
        content: content,
      };
    });

    res.status(200).json(truncatedTexts.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getTextById = async (req, res) => {
  try {
    const text = await Text.findByPk(req.params.id, {
      attributes: { exclude: ["length, id_theme"] },
    });
    if (!text) {
      return res.status(404).json({ error: "Text not found" });
    }
    res.status(200).json(text);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getTextsByTheme = async (req, res) => {
  try {
    const themeId = req.params.theme;
    const theme = await Theme.findOne({ where: { id: themeId } });

    if (!theme) {
      return res.status(404).json({ error: "Theme not found" });
    }

    const texts = await Text.findAll({ where: { id_theme: theme.id } });
    res.status(200).json(texts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createText = async (req, res) => {
  try {
    const { content, includeSentences } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const scriptToRun = includeSentences
      ? "./scripts/spacyTokenAndSentence.py"
      : "./scripts/spacyToken.py";

    exec(
      `./hostomythoenv/bin/python ${scriptToRun} "${content}"`,
      async (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
          return res.status(500).json({ error: error.message });
        }

        try {
          const output = JSON.parse(stdout);
          const tokensInfoArray = output.tokens;
          const textData = {
            num: req.body.num,
            content: req.body.content,
            length: tokensInfoArray.length,
            origin: req.body.origin,
            is_plausibility_test: req.body.is_plausibility_test || false,
            test_plausibility: req.body.is_plausibility_test
              ? req.body.test_plausibility
              : 0,
            is_hypothesis_specification_test:
              req.body.is_hypothesis_specification_test || false,
            is_condition_specification_test:
              req.body.is_condition_specification_test || false,
            is_negation_specification_test:
              req.body.is_negation_specification_test || false,
            reason_for_rate: req.body.reason_for_rate,
          };

          const text = await Text.create(textData);

          if (includeSentences) {
            const sentencesInfoArray = output.sentences;
            for (let i = 0; i < sentencesInfoArray.length; i++) {
              const sentenceInfo = sentencesInfoArray[i];
              const sentence = await Sentence.create({
                text_id: text.id,
                content: sentenceInfo.content,
                position: sentenceInfo.position,
              });

              // Insérer les tokens associés à cette phrase
              const tokensForThisSentence = tokensInfoArray.filter(
                (t) => t.sentence_position === sentenceInfo.position
              );
              for (const tokenInfo of tokensForThisSentence) {
                await Token.create({
                  text_id: text.id,
                  sentence_id: sentence.id,
                  content: tokenInfo.text,
                  position: tokenInfo.position,
                  is_punctuation: tokenInfo.is_punctuation,
                });
              }
            }
          } else {
            // Insérer les tokens sans sentences
            for (const tokenInfo of tokensInfoArray) {
              await Token.create({
                text_id: text.id,
                content: tokenInfo.text,
                position: tokenInfo.position,
                is_punctuation: tokenInfo.is_punctuation,
                sentence_id: null, // Aucune sentence associée
              });
            }
          }
          // if (req.body.is_plausibility_test && req.body.errors) {
          //   for (const error of req.body.errors) {
          //     await TestPlausibilityError.create({
          //       text_id: text.id,
          //       content: error.content,
          //       word_positions: error.word_positions,
          //     });
          //   }
          // }

          res.status(201).json(text);
        } catch (innerError) {
          console.error(`Database or data error: ${innerError}`);
          res.status(500).json({ error: innerError.message });
        }
      }
    );
  } catch (outerError) {
    console.error(`Outer error: ${outerError}`);
    res.status(500).json({ error: outerError.message });
  }
};

const updateText = async (req, res) => {
  const textId = req.params.id;
  try {
    await Text.update(req.body, {
      where: {
        id: textId,
      },
    });
    res.status(200).send("Text updated");
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteText = async (req, res) => {
  // TODO Vérifier les id et que les réponses enregistrées poitent vers le bon id, ou sont supprimées
  const textId = req.params.id;
  try {
    await Text.destroy({
      where: {
        id: textId,
      },
    });
    res.status(200).send("Text deleted");
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getTextsByOrigin = async (req, res) => {
  try {
    const origin = req.params.origin;
    const texts = await Text.findAll({ where: { origin } });
    res.status(200).json(texts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getTextWithTokensById = async (req, res) => {
  try {
    const { textId } = req.params;

    const text = await Text.findOne({
      where: {
        id: textId,
      },
      attributes: [
        "id",
        "num",
        "origin",
        "id_theme",
        "is_plausibility_test",
        "test_plausibility",
        "is_hypothesis_specification_test",
        "is_condition_specification_test",
        "is_negation_specification_test",
        "length",
      ],
      include: [
        {
          model: Token,
          attributes: ["id", "content", "position", "is_punctuation"],
        },
      ],
    });

    if (!text) {
      return res.status(404).json({ error: "Text not found" });
    }

    // Trier les tokens par leur position
    text.tokens.sort((a, b) => a.position - b.position);

    res.status(200).json(text);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getTextTestNegation = async (req, res) => {
  try {
    // trouver un texte qui a le champ is_negation_specification à true
    const text = await Text.findOne({
      where: {
        is_negation_specification_test: true,
        is_active: true,
      },
      attributes: [
        "id",
        // "num",
        // "origin",
        // "is_negation_specification_test",
        // "length",
      ],
      order: Sequelize.literal("RAND()"),
      include: [
        {
          model: Token,
          attributes: ["id", "content", "position", "is_punctuation"],
        },
      ],
    });
    if (!text) {
      return res.status(404).json({ error: "No more texts to process" });
    }
    text.tokens.sort((a, b) => a.position - b.position);

    res.status(200).json(text);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAllTexts,
  getTextById,
  getTextsByTheme,
  createText,
  updateText,
  deleteText,
  getTextsByOrigin,
  getTextWithTokensNotPlayed,
  getSmallTextWithTokens,
  getTextWithTokensById,
  // getTextTestPlausibility,
  getTextTestNegation,
  getTextWithTokensByGameType,
  getNumberOfTexts,
};
