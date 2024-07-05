var express = require("express");
var router = express.Router();
const { User } = require("../models"); // Import your User model
const { authMiddleware } = require("../middleware/authMiddleware");
const userController = require("../controllers/userController");
const moment = require("moment");
const { adminAuthMiddleware } = require("../middleware/authMiddleware");

router.get("/protected-route", authMiddleware, (req, res) => {
  // Route protégée par l'authentification
});

/* GET users listing. */
// router.get("/", userController.getAllUsers);

// POST new user (signup)
router.post("/signup", userController.signup);

// POST user login (signin)
router.post("/signin", userController.signin);

// Récupération du rang de l'utilisateur
router.get("/getUserRanking/:id", userController.getUserRanking);

router.get("/getCoeffMultiByUserId/:id", userController.getCoeffMultiByUserId);

router.get(
  "/getMessageReadByUserId/:id",
  userController.getMessageReadByUserId
);

router.put(
  "/updateMessageReadByUserId/:id",
  userController.updateMessageReadByUserId
);

router.get("/getUsersOrderedByPoints", userController.getUsersOrderedByPoints);

// Récupération du rang de l'utilisateur et des joueurs les plus proches de lui au score
router.get("/getUserRankingRange/:id", userController.getUserRankingRange);

// Infos autre joueur
router.get("/getUserDetailsById/:id", userController.getUserDetailsById);

// Classement mensuel
router.get(
  "/getUsersOrderedByPointsInMonthly",
  userController.getUsersOrderedByPointsInMonthly
);

// Décrémente proba
router.put("/:id/catchProbability", userController.incrementCatchProbability);

router.get(
  "/getUserRankingRangeInMonthly/:id",
  userController.getUserRankingRangeInMonthly
);
router.get("/getTopMonthlyWinners", userController.getTopMonthlyWinners);

// TODO mettre token
router.put("/:id/updateUserEmail", userController.updateUserEmail);

// TODO mettre token
router.put(
  "/:id/incrementTutorialProgress",
  userController.incrementTutorialProgress
);

router.put("/:id/resetCatchProbability", userController.resetCatchProbability);

// TODO mettre token
router.get("/:id", async function (req, res, next) {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ["password"] },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.dataValues.created_at = moment(user.created_at)
      .locale("fr")
      .format("DD MMMM YYYY");

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// TODO a tester sans
// router.put("/:id", async function (req, res, next) {
//   const userId = req.params.id;
//   try {
//     await User.update(req.body, {
//       where: {
//         id: userId,
//       },
//     });
//     res.status(200).send("User updated");
//   } catch (err) {
//     next(err);
//   }
// });

// A sécuriser
router.delete("/:id", async function (req, res, next) {
  const userId = req.params.id;
  try {
    await User.destroy({
      where: {
        id: userId,
      },
    });
    res.status(200).send("User deleted");
  } catch (err) {
    next(err);
  }
});

module.exports = router;
