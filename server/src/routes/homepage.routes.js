const express = require("express");

const { getStats } = require("../controllers/homepage.controller");

const router = express.Router();

router.get("/stats", getStats);

module.exports = router;
