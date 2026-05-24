const express = require("express");

const {
  getNotifications,
  readAllNotifications,
} = require("../controllers/notification.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", verifyToken, getNotifications);
router.patch("/read-all", verifyToken, readAllNotifications);
router.post("/read-all", verifyToken, readAllNotifications);

module.exports = router;
