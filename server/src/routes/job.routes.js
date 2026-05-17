const express = require("express");

const {
  createJobRequest,
  getJobTypes,
} = require("../controllers/job.controller");
const {
  getLevels,
} = require("../controllers/level.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/types", getJobTypes);
router.get("/job-types", getJobTypes);
router.get("/levels", getLevels);
router.get("/job-levels", getLevels);
router.post("/", verifyToken, createJobRequest);
router.post("/create", verifyToken, createJobRequest);

module.exports = router;
