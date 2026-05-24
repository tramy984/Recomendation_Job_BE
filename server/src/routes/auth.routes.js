const express = require("express");
const {
  changePassword,
  register,
  login,
  checkEmailRegistered,
  requestEmailOtp,
  verifyEmailOtp,
  requestPhoneOtp,
  verifyPhoneOtp,
} = require("../controllers/auth.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/email/check", checkEmailRegistered);
router.post("/email/request-otp", requestEmailOtp);
router.post("/email/verify-otp", verifyEmailOtp);
router.post("/phone/request-otp", verifyToken, requestPhoneOtp);
router.post("/phone/verify-otp", verifyToken, verifyPhoneOtp);
router.patch("/change-password", verifyToken, changePassword);
router.put("/change-password", verifyToken, changePassword);

module.exports = router;
