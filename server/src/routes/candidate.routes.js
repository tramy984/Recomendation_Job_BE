const express = require("express");

const {
  getMyCandidate,
  updateMyCandidate,
} = require("../controllers/candidate.controller");

const { verifyToken } = require("../middlewares/auth.middleware");

const { uploadCandidateAvatar } = require("../middlewares/upload.middleware");

const router = express.Router();

router.get("/me", verifyToken, getMyCandidate);

router.put("/me", verifyToken, uploadCandidateAvatar, updateMyCandidate);

module.exports = router;
