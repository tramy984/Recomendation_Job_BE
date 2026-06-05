const fs = require("fs");
const path = require("path");
const multer = require("multer");

const recruiterUploadDir = path.join(__dirname, "../../uploads/recruiters");
const candidateUploadDir = path.join(__dirname, "../../uploads/candidates");
const cvUploadDir = path.join(__dirname, "../../uploads/cvs");
const pendingCompanyCertificateUploadDir = path.join(
  __dirname,
  "../../uploads/pending-companies/certificates",
);
const pendingCompanyLogoUploadDir = path.join(
  __dirname,
  "../../uploads/pending-companies/logos",
);

fs.mkdirSync(recruiterUploadDir, { recursive: true });
fs.mkdirSync(pendingCompanyCertificateUploadDir, { recursive: true });
fs.mkdirSync(pendingCompanyLogoUploadDir, { recursive: true });
fs.mkdirSync(candidateUploadDir, { recursive: true });
fs.mkdirSync(cvUploadDir, { recursive: true });

const looksLikeMojibake = (value) => {
  return /(?:Ã.|Â.|Ä.|Æ.|á[º»]|à[º»]|â[º»]|í[º»]|ó[º»]|ú[º»]|Ð|ð)/.test(
    value,
  );
};

const normalizeUploadedFileName = (originalName, fallbackName) => {
  const rawName = String(originalName || "").trim();
  const decodedName = looksLikeMojibake(rawName)
    ? Buffer.from(rawName, "latin1").toString("utf8")
    : rawName;

  const safeName = path
    .basename(decodedName)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return safeName || fallbackName;
};

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
const cvStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, cvUploadDir);
  },
  filename: (_req, file, cb) => {
    file.originalname = normalizeUploadedFileName(file.originalname, "cv.pdf");

    const ext = path.extname(file.originalname).toLowerCase();

    const baseName =
      path
        .basename(file.originalname, ext)
        .replace(/[^a-z0-9_-]/gi, "-")
        .slice(0, 60) || "cv";

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
const pendingCompanyLogoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, pendingCompanyLogoUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName =
      path
        .basename(file.originalname, ext)
        .replace(/[^a-z0-9_-]/gi, "-")
        .slice(0, 60) || "logo";

    cb(
      null,
      `${Date.now()}-${Math.round(Math.random() * 1e9)}-${baseName}${ext}`,
    );
  },
});
const pendingCompanyFilesStorage = multer.diskStorage({
  destination: (_req, file, cb) => {
    if (file.fieldname === "certificate") {
      return cb(null, pendingCompanyCertificateUploadDir);
    }

    return cb(null, pendingCompanyLogoUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const fallbackName = file.fieldname === "certificate" ? "certificate" : "logo";
    const baseName =
      path
        .basename(file.originalname, ext)
        .replace(/[^a-z0-9_-]/gi, "-")
        .slice(0, 60) || fallbackName;

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
const uploadCVFile = multer({
  storage: cvStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype !== "application/pdf" &&
      path.extname(file.originalname).toLowerCase() !== ".pdf"
    ) {
      return cb(new Error("CV phải là file PDF."));
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
const uploadPendingCompanyLogoFile = multer({
  storage: pendingCompanyLogoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("File logo phai la hinh anh."));
    }

    return cb(null, true);
  },
});
const uploadPendingCompanyFilesFile = multer({
  storage: pendingCompanyFilesStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "logo") {
      if (!file.mimetype.startsWith("image/")) {
        return cb(new Error("File logo phai la hinh anh."));
      }

      return cb(null, true);
    }

    if (file.fieldname === "certificate") {
      if (
        file.mimetype !== "application/pdf" &&
        path.extname(file.originalname).toLowerCase() !== ".pdf"
      ) {
        return cb(new Error("File giay chung nhan phai la PDF."));
      }

      return cb(null, true);
    }

    return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
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
const uploadCV = (req, res, next) => {
  uploadCVFile.single("cv")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (
      error instanceof multer.MulterError &&
      error.code === "LIMIT_FILE_SIZE"
    ) {
      return res.status(400).json({
        success: false,
        message: "CV không được vượt quá 5MB.",
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || "Tải CV thất bại.",
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
          message: "File giấy chứng nhận không được vượt quá 5MB.",
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message || "Tải file giấy chứng nhận thất bại.",
      });
    },
  );
};
const uploadPendingCompanyLogo = (req, res, next) => {
  uploadPendingCompanyLogoFile.single("logo")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (
      error instanceof multer.MulterError &&
      error.code === "LIMIT_FILE_SIZE"
    ) {
      return res.status(400).json({
        success: false,
        message: "File logo không được vượt quá 5MB.",
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || "Tải file logo thất bại.",
    });
  });
};
const uploadPendingCompanyFiles = (req, res, next) => {
  uploadPendingCompanyFilesFile.fields([
    { name: "logo", maxCount: 1 },
    { name: "certificate", maxCount: 1 },
  ])(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (
      error instanceof multer.MulterError &&
      error.code === "LIMIT_FILE_SIZE"
    ) {
      return res.status(400).json({
        success: false,
        message: "File tải lên không được vượt quá 5MB.",
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || "Tải file thất bại.",
    });
  });
};

module.exports = {
  uploadPendingCompanyCertificate,
  uploadPendingCompanyFiles,
  uploadPendingCompanyLogo,
  uploadRecruiterAvatar,
  uploadCandidateAvatar,
  uploadCV,
};
