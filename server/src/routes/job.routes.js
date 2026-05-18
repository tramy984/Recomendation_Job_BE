const express = require("express");

const {
  closeMyCompanyJob,
  createJobRequest,
  extendMyCompanyJob,
  getMyCompanyJobs,
  getJobTypes,
  reopenMyCompanyJob,
  updateExpiredJobsRequest,
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
router.get("/company/me", verifyToken, getMyCompanyJobs);
router.patch("/expired/status", verifyToken, updateExpiredJobsRequest);
router.post("/expired/status", verifyToken, updateExpiredJobsRequest);
router.post("/", verifyToken, createJobRequest);
router.post("/create", verifyToken, createJobRequest);
router.patch("/:jobId/close", verifyToken, closeMyCompanyJob);
router.post("/:jobId/close", verifyToken, closeMyCompanyJob);
router.patch("/:jobId/reopen", verifyToken, reopenMyCompanyJob);
router.post("/:jobId/reopen", verifyToken, reopenMyCompanyJob);
router.patch("/:jobId/extend", verifyToken, extendMyCompanyJob);
router.post("/:jobId/extend", verifyToken, extendMyCompanyJob);

module.exports = router;
