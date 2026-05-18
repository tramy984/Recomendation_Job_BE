const express = require("express");

const { getIndustries } = require("../controllers/industry.controller");

const router = express.Router();

router.get("/", getIndustries);

module.exports = router;
