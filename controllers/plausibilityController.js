const {
  Text,
  UserErrorDetail,
  Sentence,
  Token,
  GroupTextRating,
  UserTextRating,
  UserCommentsGroupTextRating,
} = require("../models");
const { Op } = require("sequelize");
const { Sequelize } = require("sequelize");
const { sequelize } = require("../service/db.js");
const {
  createUserTextRating,
  createUserErrorDetail,
} = require("../controllers/errorController");
const {
  updateUserStats,
  getUserById,
} = require("../controllers/userController");

const getText = async (req, res) => {
  try {
    const randomNumber = Math.floor(Math.random() * 100);
    // TODO ici, mettre un appel à getTextTestPlausibility pour 20% autre % de cas
    const nbToken = 110;

    let text, group;

    if (randomNumber < 25) {
      return await getTextTestPlausibility(req, res);
    } else if (randomNumber >= 25 && randomNumber < 45) {
      // Choix d'un texte déjà joué tiré de GroupTextRating
      group = await GroupTextRating.findOne({
        order: Sequelize.literal("RAND()"),
        include: {
          model: Text,
          attributes: ["id"],
        },
      });

      if (!group || !group.text) {
        return res.status(404).json({ error: "No suitable group text found" });
      }

      let sentences;
      if (group.sentence_positions === "full") {
        sentences = await Sentence.findAll({
          where: { text_id: group.text.id },
          order: [["position", "ASC"]],
          include: [
            {
              model: Token,
              attributes: ["id", "content", "position", "is_punctuation"],
              required: true,
            },
          ],
        });
      } else {
        const positions = group.sentence_positions
          .split(",")
          .map((pos) => parseInt(pos));

        sentences = await Sentence.findAll({
          where: {
            text_id: group.text.id,
            position: positions,
          },
          order: [["position", "ASC"]],
          include: [
            {
              model: Token,
              attributes: ["id", "content", "position", "is_punctuation"],
              required: true,
            },
          ],
        });
      }

      let tokens = sentences.flatMap((sentence) =>
        sentence.tokens.map((token) => ({
          id: token.id,
          content: token.content,
          position: token.position,
          is_punctuation: token.is_punctuation,
        }))
      );
      let result = {
        id: group.text.id,
        sentence_positions: sentences
          .map((sentence) => sentence.position)
          .join(", "),
        tokens: tokens,
      };

      return res.status(200).json(result);
    } else {
      text = await Text.findOne({
        where: { is_plausibility_test: false, is_active: true },
        attributes: ["id"],
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
          // Sélectionner depuis le début
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
        sentence_positions:
          selectedSentences.length === sentences.length
            ? "full"
            : selectedSentences.map((sentence) => sentence.position).join(", "),
        tokens: groupedTokens,
      };

      res.status(200).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getErrorDetailTest = async (req, res) => {
  const textId = req.params.textId;

  try {
    const plausibilityErrors = await UserErrorDetail.findAll({
      where: {
        text_id: textId,
        is_test: true,
        test_error_type_id: {
          [Op.ne]: 10,
        },
      },
    });
    res.status(200).json(plausibilityErrors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const sendResponse = async (req, res) => {
  const {
    textId,
    userErrorDetails,
    userRateSelected,
    sentencePositions,
    userId,
    userComment,
    responseNum,
  } = req.body;
  let transaction;
  let pointsToAdd = 0;
  let percentageToAdd = 0;
  let trustIndexIncrement = 0;
  let success = true;
  let message = "";
  let averagePlausibility = null;
  let correctPositions = [];
  let correctPlausibility = null;
  let groupId = null;
  try {
    transaction = await sequelize.transaction();
    const textDetails = await getTextDetailsById(textId);
    const user = await getUserById(userId);

    if (!textDetails) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Text not found" });
    }

    await Text.increment("nb_of_treatments", {
      by: 1,
      where: { id: textId },
      transaction,
    });

    if (textDetails.is_plausibility_test) {
      let checkResult = await checkUserSelectionPlausibility(
        textId,
        userErrorDetails,
        userRateSelected
      );

      const noErrorSpecified = userErrorDetails.length === 0;
      const noErrorInDatabase = checkResult.testPlausibilityError.length === 0;
      if (!checkResult.isValid && responseNum < 6) {
        console.log("********** Suspicion de spam ************ ");
        console.log("user", userId);
        pointsToAdd = 0;
        percentageToAdd = 0;
        trustIndexIncrement = -15;
        success = false;
        message = checkResult.reasonForRate;
        correctPlausibility = checkResult.correctPlausibility;
      } else if (noErrorSpecified || noErrorInDatabase) {
        if (checkResult.testPlausibilityPassed) {
          pointsToAdd = 14;
          percentageToAdd = 5;
          trustIndexIncrement = 1;
          success = true;
        } else {
          pointsToAdd = 0;
          percentageToAdd = 0;
          trustIndexIncrement = -1;
          success = false;
          message = checkResult.reasonForRate;
          correctPlausibility = checkResult.correctPlausibility;
        }
      } else {
        const correctSpecification = checkResult.testPlausibilityError
          .map((spec) => `• ${spec.content}`)
          .join("\n");
        correctPositions = checkResult.testPlausibilityError.flatMap((spec) =>
          spec.word_positions.split(",").map((pos) => parseInt(pos))
        );

        if (
          !checkResult.isErrorDetailsCorrect &&
          checkResult.testPlausibilityPassed
        ) {
          pointsToAdd = 14;
          percentageToAdd = 5;
          trustIndexIncrement = 1;
          success = false;
          message = `Vous avez bien estimé la plausibilité, mais voilà les erreurs qu'il fallait trouver :\n${correctSpecification}`;
        } else if (
          !checkResult.isErrorDetailsCorrect &&
          !checkResult.testPlausibilityPassed
        ) {
          pointsToAdd = 0;
          percentageToAdd = 0;
          trustIndexIncrement = -1;
          success = false;
          message = `${checkResult.reasonForRate}\nLes erreurs à trouver étaient :\n${correctSpecification}`;
          correctPlausibility = checkResult.correctPlausibility;
        } else if (
          checkResult.isErrorDetailsCorrect &&
          !checkResult.testPlausibilityPassed
        ) {
          pointsToAdd = 14 + userErrorDetails.length;
          percentageToAdd = 5;
          trustIndexIncrement = 1;
          success = false;
          message =
            "Vous avez bien identifié les zones de doute, mais la plausibilité estimée était incorrecte.";
          correctPlausibility = checkResult.correctPlausibility;
        } else if (
          checkResult.isErrorDetailsCorrect &&
          checkResult.testPlausibilityPassed
        ) {
          pointsToAdd = 16 + userErrorDetails.length;
          percentageToAdd = 6;
          trustIndexIncrement = 2;
          success = true;
        }
      }
    } else {
      const { newUserTextRating, isNewGroup } = await createUserTextRating(
        {
          user_id: userId,
          text_id: textId,
          plausibility: userRateSelected,
          vote_weight: user.trust_index,
          sentence_positions: sentencePositions,
        },
        transaction
      );

      let existingComments = await UserCommentsGroupTextRating.findOne({
        where: { group_id: newUserTextRating.group_id },
        transaction: transaction,
      });

      if (userComment) {
        await UserCommentsGroupTextRating.create(
          {
            user_id: userId,
            group_id: newUserTextRating.group_id,
            comment: userComment,
          },
          { transaction: transaction }
        );
      }
      for (let errorDetail of userErrorDetails) {
        await createUserErrorDetail({
          ...errorDetail,
          user_id: userId,
          text_id: textId,
          vote_weight: user.trust_index,
          content: errorDetail.content,
        });
      }

      if (newUserTextRating) {
        if (!isNewGroup) {
          if (existingComments) {
            groupId = newUserTextRating.group_id;
          }

          let allRatingsForGroup = await UserTextRating.findAll({
            where: { group_id: newUserTextRating.group_id },
            transaction: transaction,
          });
          if (allRatingsForGroup.length > 1) {
            const totalWeight = allRatingsForGroup.reduce(
              (acc, rating) => acc + rating.vote_weight,
              0
            );
            const weightedSum = allRatingsForGroup.reduce(
              (acc, rating) =>
                acc + parseFloat(rating.plausibility) * rating.vote_weight,
              0
            );
            averagePlausibility = Math.round(
              totalWeight > 0 ? weightedSum / totalWeight : 0
            );
            success = Math.abs(averagePlausibility - userRateSelected) <= 13;
            pointsToAdd = success
              ? 14 + userErrorDetails.length
              : 5 + userErrorDetails.length;
            trustIndexIncrement = success ? 1 : -1;
            percentageToAdd = success ? 5 : 2;
            message = success
              ? "Les autres enquêteurs sont d'accord avec vous."
              : "Les autres enquêteurs ont, de leurs côtés, donné des réponses différentes.";
          }
        } else {
          // Nouveau groupe
          pointsToAdd = 14 + userErrorDetails.length;
          percentageToAdd = 5;
          trustIndexIncrement = 0;
        }
      }
    }

    if (userId > 0) {
      // vérifier pointsToAdd
      const updatedStats = await updateUserStats(
        userId,
        pointsToAdd,
        percentageToAdd,
        trustIndexIncrement,
        transaction
      );
      await transaction.commit();

      return res.status(200).json({
        success: success,
        groupId: groupId,
        newPoints: updatedStats.newPoints,
        newCatchProbability: updatedStats.newCatchProbability,
        newTrustIndex: updatedStats.newTrustIndex,
        newCoeffMulti: updatedStats.newCoeffMulti,
        newAchievements: updatedStats.newAchievements,
        showSkinModal: updatedStats.showSkinModal,
        skinData: updatedStats.skinData,
        message: message,
        correctPositions: correctPositions,
        averagePlausibility: !success ? averagePlausibility : null,
        correctPlausibility: correctPlausibility,
      });
    } else {
      await transaction.commit();

      return res.status(200).json({
        success: success,
        message: message,
        correctPositions: correctPositions,
        correctPlausibility: correctPlausibility,
      });
    }
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("Error in sendResponse:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const getTextTestPlausibility = async (req, res) => {
  try {
    // trouver un texte qui a le champ is_plausibility_test à true
    const text = await Text.findOne({
      where: {
        is_plausibility_test: true,
        is_active: true,
      },
      attributes: ["id"],
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

const checkUserSelectionPlausibility = async (
  textId,
  userErrorDetails,
  userRateSelected,
  plausibilityMargin = 25,
  tokenErrorMargin = 1
) => {
  try {
    const textDetails = await getTextDetailsById(textId);
    if (!textDetails) throw new Error("Text details not found");
    const testPlausibilityError = await getTestPlausibilityErrorByTextId(
      textId
    );

    const textPlausibility = parseFloat(textDetails.test_plausibility);
    const isPlausibilityCorrect =
      Math.abs(userRateSelected - textPlausibility) <= plausibilityMargin;

    let isValid = isPlausibilityCorrect;
    let reasonForRate = textDetails.reason_for_rate || "";

    const isErrorDetailsCorrect =
      testPlausibilityError.length > 0
        ? areUserErrorsCorrect(
            userErrorDetails,
            testPlausibilityError,
            tokenErrorMargin
          )
        : true;

    return {
      isValid: isValid && isErrorDetailsCorrect,
      testPlausibilityError: isErrorDetailsCorrect ? [] : testPlausibilityError,
      correctPlausibility: textPlausibility,
      testPlausibilityPassed: isPlausibilityCorrect,
      isErrorDetailsCorrect,
      reasonForRate,
    };
  } catch (error) {
    console.error("Error in checkUserSelectionPlausibility:", error);
    return {
      isValid: false,
      testPlausibilityError: [],
    };
  }
};

const areUserErrorsCorrect = (
  userErrorDetails,
  testPlausibilityError,
  tokenErrorMargin
) => {
  const allTestErrorPositions = testPlausibilityError.flatMap((spec) =>
    spec.word_positions.split(",").map((pos) => parseInt(pos))
  );

  return userErrorDetails.some((errorDetail) => {
    const userWordPositions = errorDetail.word_positions
      .split(",")
      .map((pos) => parseInt(pos));
    return userWordPositions.some((userPos) =>
      allTestErrorPositions.some(
        (testPos) => Math.abs(testPos - userPos) <= tokenErrorMargin
      )
    );
  });
};

const getTestPlausibilityErrorByTextId = async (textId) => {
  try {
    const testPlausibilityErrors = await UserErrorDetail.findAll({
      where: {
        text_id: textId,
        is_test: true,
      },
      attributes: ["id", "text_id", "word_positions", "content"],
    });
    return testPlausibilityErrors.map((error) => {
      return {
        id: error.id,
        text_id: error.text_id,
        word_positions: error.word_positions,
        content: error.content,
      };
    });
  } catch (error) {
    console.error(
      "Error fetching test plausibility errors from UserErrorDetail:",
      error
    );
    throw new Error(
      "Error fetching test plausibility errors from UserErrorDetail"
    );
  }
};

const getTextDetailsById = async (textId) => {
  try {
    const textDetails = await Text.findOne({
      where: { id: textId },
      attributes: [
        "test_plausibility",
        "reason_for_rate",
        "is_plausibility_test",
      ],
    });
    return textDetails;
  } catch (error) {
    console.error("Error fetching text details:", error);
    throw new Error("Error fetching text details");
  }
};

module.exports = {
  getTextTestPlausibility,
  areUserErrorsCorrect,
  checkUserSelectionPlausibility,
  sendResponse,
  getErrorDetailTest,
  getText,
};
