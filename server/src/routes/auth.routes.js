const express = require("express");
const {
  changePassword,
  register,
  login,
} = require("../controllers/auth.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.patch("/change-password", verifyToken, changePassword);
router.put("/change-password", verifyToken, changePassword);

module.exports = router;
