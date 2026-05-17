const express = require("express");

const {
  createJobRequest,
  getJobTypes,
} = require("../controllers/job.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/types", getJobTypes);
router.get("/job-types", getJobTypes);
router.post("/", verifyToken, createJobRequest);
router.post("/create", verifyToken, createJobRequest);

module.exports = router;
