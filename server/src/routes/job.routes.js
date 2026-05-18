const express = require("express");

const {
  approveApplicationRequest,
  closeMyCompanyJob,
  createJobRequest,
  extendMyCompanyJob,
  getJobApplicationsRequest,
  getJobDetailRequest,
  getMyCompanyJobs,
  getJobTypes,
  rejectApplicationRequest,
  reopenMyCompanyJob,
  updateExpiredJobsRequest,
  updateJob,
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
router.patch(
  "/applications/:applicationId/approve",
  verifyToken,
  approveApplicationRequest
);
router.post(
  "/applications/:applicationId/approve",
  verifyToken,
  approveApplicationRequest
);
router.patch(
  "/applications/:applicationId/reject",
  verifyToken,
  rejectApplicationRequest
);
router.post(
  "/applications/:applicationId/reject",
  verifyToken,
  rejectApplicationRequest
);
router.get("/:jobId/applications", verifyToken, getJobApplicationsRequest);
router.get("/:jobId", getJobDetailRequest);
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
router.patch("/:id", verifyToken, updateJob);
router.put("/:id", verifyToken, updateJob);
module.exports = router;
