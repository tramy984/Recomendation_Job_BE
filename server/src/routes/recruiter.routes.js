const express = require("express");

const {
  getMyRecruiterProfile,
} = require("../controllers/recruiter.controller");

const { verifyToken } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get(
  "/:id",
  verifyToken,
  getMyRecruiterProfile
);

module.exports = router;