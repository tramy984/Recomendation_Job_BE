const express = require("express");

const {
  applyMyJob,
  getMyApplications,
  getMyCandidate,
  getMySavedJobs,
  saveMyJob,
  unsaveMyJob,
  updateMyCandidate,
} = require("../controllers/candidate.controller");

const { verifyToken } = require("../middlewares/auth.middleware");

const { uploadCandidateAvatar } = require("../middlewares/upload.middleware");

const router = express.Router();

router.get("/me", verifyToken, getMyCandidate);

router.get("/saved-jobs", verifyToken, getMySavedJobs);

router.get("/applications", verifyToken, getMyApplications);

router.post("/saved-jobs/:jobId", verifyToken, saveMyJob);

router.delete("/saved-jobs/:jobId", verifyToken, unsaveMyJob);

router.post("/jobs/:jobId/apply", verifyToken, applyMyJob);

router.put("/me", verifyToken, uploadCandidateAvatar, updateMyCandidate);

module.exports = router;
