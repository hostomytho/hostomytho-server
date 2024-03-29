var express = require("express");
var router = express.Router();
const { UserSentenceSpecification } = require("../models");

router.get("/", async function (req, res, next) {
  try {
    const userSentenceSpecifications = await UserSentenceSpecification.findAll();
    res.status(200).json(userSentenceSpecifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/getNumberSpecifications", async function (req, res) {
  try {
    const numberSpecifications = await UserSentenceSpecification.count();
    res.status(200).json(numberSpecifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async function (req, res, next) {
  try {
    const newUserSentenceSpecification = await UserSentenceSpecification.create(req.body);
    res.status(201).json(newUserSentenceSpecification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

