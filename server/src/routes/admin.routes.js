const express = require("express");

const {
  getAccounts,
  getDashboard,
} = require("../controllers/admin.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/accounts", verifyToken, getAccounts);
router.get("/dashboard", verifyToken, getDashboard);

module.exports = router;
