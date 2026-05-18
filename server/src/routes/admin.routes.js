const express = require("express");

const {
  getAccounts,
  getDashboard,
  lockAccount,
  unlockAccount,
} = require("../controllers/admin.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/accounts", verifyToken, getAccounts);
router.patch("/accounts/:userId/lock", verifyToken, lockAccount);
router.post("/accounts/:userId/lock", verifyToken, lockAccount);
router.patch("/accounts/:userId/unlock", verifyToken, unlockAccount);
router.post("/accounts/:userId/unlock", verifyToken, unlockAccount);
router.get("/dashboard", verifyToken, getDashboard);

module.exports = router;
