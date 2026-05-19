const express = require("express");

const {
  getMyCVs,
  uploadMyCV,
  setMyDefaultCV,
  deleteMyCV,
} = require("../controllers/cv.controller");

const { verifyToken } = require("../middlewares/auth.middleware");

const { uploadCV } = require("../middlewares/upload.middleware");

const router = express.Router();

router.get("/me", verifyToken, getMyCVs);

router.post("/me", verifyToken, uploadCV, uploadMyCV);

router.patch("/:cvId/default", verifyToken, setMyDefaultCV);

router.delete("/:cvId", verifyToken, deleteMyCV);

module.exports = router;
