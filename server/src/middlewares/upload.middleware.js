const fs = require("fs");
const path = require("path");
const multer = require("multer");

const recruiterUploadDir = path.join(__dirname, "../../uploads/recruiters");

fs.mkdirSync(recruiterUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, recruiterUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName =
      path
        .basename(file.originalname, ext)
        .replace(/[^a-z0-9_-]/gi, "-")
        .slice(0, 40) || "avatar";

    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${baseName}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("File tải lên phải là hình ảnh."));
    }

    return cb(null, true);
  },
});

const uploadRecruiterAvatar = (req, res, next) => {
  upload.single("avatar")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Ảnh đại diện không được vượt quá 5MB.",
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || "Tải ảnh thất bại.",
    });
  });
};

module.exports = {
  uploadRecruiterAvatar,
};
