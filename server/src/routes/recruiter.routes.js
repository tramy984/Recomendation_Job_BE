const express = require("express");

const {
  getMyRecruiterProfile,
  getMyRecruiterPostingChecklist,
  updateMyRecruiterProfile,
} = require("../controllers/recruiter.controller");

const { verifyToken } = require("../middlewares/auth.middleware");
const { uploadRecruiterAvatar } = require("../middlewares/upload.middleware");

const router = express.Router();

router.get("/posting/check", verifyToken, getMyRecruiterPostingChecklist);
router.get("/profile/me", verifyToken, getMyRecruiterProfile);

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
