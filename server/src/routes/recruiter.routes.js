const express = require("express");

const {
  getRecruiterDetail,
  getMyRecruiterProfile,
  getMyRecruiterPostingChecklist,
  getMyRecruiterStatistics,
  updateMyRecruiterProfile,
} = require("../controllers/recruiter.controller");

const { verifyToken } = require("../middlewares/auth.middleware");
const { uploadRecruiterAvatar } = require("../middlewares/upload.middleware");

const router = express.Router();

router.get("/posting/check", verifyToken, getMyRecruiterPostingChecklist);
router.get("/profile/me", verifyToken, getMyRecruiterProfile);
router.get("/statistics", verifyToken, getMyRecruiterStatistics);
router.get("/:recruiterId", verifyToken, getRecruiterDetail);

router.patch(
  "/profile/me",
  verifyToken,
  uploadRecruiterAvatar,
  updateMyRecruiterProfile
);

router.put(
  "/profile/me",
  verifyToken,
  uploadRecruiterAvatar,
  updateMyRecruiterProfile
);

module.exports = router;
