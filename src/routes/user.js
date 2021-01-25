import express from "express";
import axios from "axios";
import array from "lodash/array.js";

import User from "../models/User.js";

const router = express.Router();

const getUser = async (req, res, next) => {
  try {
    const {
      name
    } = req.query;
    const user = await User.findOne({
      name
    });
    if (user) {
      req.query.user = user;
    }
    next();
  } catch (err) {
    res.status(401).send(err);
  }
};

router.post("/api/register", async (req, res) => {
  try {
    const exists = await User.findOne({
      name: req.body.name
    });
    if (exists) {
      res.status(409).send("User already exists");
    } else {
      const user = new User(req.body);
      await user.save();
      res.status(201).send(user);
    }
  } catch (err) {
    res.status(500).send("Failed to register user");
  }
});

router.post("/api/login", async (req, res) => {
  try {
    if (req.query.name) req.body.name = req.query.name;

    const user = await User.findOne({
      name: req.body.name
    });
    if (!user) {
      res.status(204).send();
    } else {
      res
        .status(200)
        .cookie("name", user.name, {
          maxAge: 1000 * 60 * 10,
          httpOnly: false,
        })
        .send({
          user
        });
    }
  } catch (err) {
    res.status(401).send(err);
  }
});

router.get("/api/results", getUser, async (req, res) => {
  try {
    res.status(200).send(req.query.user.results);
  } catch (err) {
    res.status(401).send(err);
  }
});

const correctAns = (correct, given) => {
  const diff = array.intersection(correct, given);
  return diff.length === correct.length && correct.length === given.length;
};

const markResults = async (results) => {
  const concepts = array.uniq(results.map(ques => ques.misconception))
  const count = {};

  concepts.forEach(concept => (count[concept] = {
    total: 0,
    correct: 0
  }))

  results.forEach(ans => {
    count[ans.misconception].total++;
    if (ans.correct) count[ans.misconception].correct++;
  })

  return count;
}

router.post("/api/results", getUser, async (req, res) => {
  try {
    const {
      results
    } = req.body;
    const questions = await axios.get("/api/questions");

    const correct = questions.data[0].pages[0].elements.map((question) => ({
      misconception: question.misconception,
      correct: correctAns(question.correctAnswer, results[question.valueName]),
    }));

    const markedResults = markResults(correct);



    req.query.user.results = markedResults;
    await req.query.user.save();
    res.status(200).send(markedResults);
  } catch (err) {
    res.status(401).send(err);
  }
});

router.patch("/api/takenQuiz", async (req, res) => {
  try {
    const {
      name
    } = req.query;
    const user = await User.findOne({
      name
    });
    user.takenQuiz = true;

    await user.save();

    res.status(200).send(user);
  } catch (err) {
    res.status(401).send(err);
  }
});

router.get("/api/allResults", async (req, res) => {
  try {
    const allUsers = await User.find();
    const allResults = allUsers.map((user) => ({
      results: user.results,
      name: user.name
    }));

    //const totalResults = allResults.reduce((total, result) => {
    //Object.keys(result.results).forEach((concept) => {
    //acc[concept].total += concept.total;
    //acc[concept].correct += concept.correct;
    //});
    //}, {});

    res.status(200).send(allResults);
  } catch (err) {
    res.status(401).send(err);
  }
});

export default router;
