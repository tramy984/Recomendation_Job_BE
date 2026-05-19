const fs = require("fs");
const path = require("path");
const multer = require("multer");

const recruiterUploadDir = path.join(__dirname, "../../uploads/recruiters");
const candidateUploadDir = path.join(__dirname, "../../uploads/candidates");
const pendingCompanyCertificateUploadDir = path.join(
  __dirname,
  "../../uploads/pending-companies/certificates",
);

fs.mkdirSync(recruiterUploadDir, { recursive: true });
fs.mkdirSync(pendingCompanyCertificateUploadDir, { recursive: true });
fs.mkdirSync(candidateUploadDir, { recursive: true });

const recruiterAvatarStorage = multer.diskStorage({
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

    cb(
      null,
      `${Date.now()}-${Math.round(Math.random() * 1e9)}-${baseName}${ext}`,
    );
  },
});
const candidateAvatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, candidateUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    const baseName =
      path
        .basename(file.originalname, ext)
        .replace(/[^a-z0-9_-]/gi, "-")
        .slice(0, 40) || "avatar";

    cb(
      null,
      `${Date.now()}-${Math.round(Math.random() * 1e9)}-${baseName}${ext}`,
    );
  },
});
const pendingCompanyCertificateStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, pendingCompanyCertificateUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName =
      path
        .basename(file.originalname, ext)
        .replace(/[^a-z0-9_-]/gi, "-")
        .slice(0, 60) || "certificate";

    cb(
      null,
      `${Date.now()}-${Math.round(Math.random() * 1e9)}-${baseName}${ext}`,
    );
  },
});

const uploadRecruiterAvatarFile = multer({
  storage: recruiterAvatarStorage,
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
const uploadCandidateAvatarFile = multer({
  storage: candidateAvatarStorage,
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
const uploadPendingCompanyCertificateFile = multer({
  storage: pendingCompanyCertificateStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype !== "application/pdf" &&
      path.extname(file.originalname).toLowerCase() !== ".pdf"
    ) {
      return cb(new Error("File tai len phai la PDF."));
    }

    return cb(null, true);
  },
});

const uploadRecruiterAvatar = (req, res, next) => {
  uploadRecruiterAvatarFile.single("avatar")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (
      error instanceof multer.MulterError &&
      error.code === "LIMIT_FILE_SIZE"
    ) {
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
const uploadCandidateAvatar = (req, res, next) => {
  uploadCandidateAvatarFile.single("avatar")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (
      error instanceof multer.MulterError &&
      error.code === "LIMIT_FILE_SIZE"
    ) {
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
const uploadPendingCompanyCertificate = (req, res, next) => {
  uploadPendingCompanyCertificateFile.single("certificate")(
    req,
    res,
    (error) => {
      if (!error) {
        return next();
      }

      if (
        error instanceof multer.MulterError &&
        error.code === "LIMIT_FILE_SIZE"
      ) {
        return res.status(400).json({
          success: false,
          message: "File giay chung nhan khong duoc vuot qua 5MB.",
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message || "Tai file giay chung nhan that bai.",
      });
    },
  );
};

module.exports = {
  uploadPendingCompanyCertificate,
  uploadRecruiterAvatar,
  uploadCandidateAvatar,
};
