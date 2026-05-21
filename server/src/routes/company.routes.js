const express = require("express");

const {
  approvePendingCompanyRequest,
  createPendingCompanyRequest,
  createPendingCompanyUpdateRequest,
  getCompaniesByNameFromCompanyTable,
  getCompanies,
  getCompanyDetail,
  getMyPendingCompanies,
  getMyCompany,
  getPendingCompaniesWaitingConfirmation,
  rejectPendingCompanyRequest,
  searchCompaniesByName,
  updateCompanyRequest,
  updatePendingCompanyCertificate,
  updatePendingCompanyRequest,
} = require("../controllers/company.controller");

const { verifyToken } = require("../middlewares/auth.middleware");

const {
  uploadPendingCompanyFiles,
  uploadPendingCompanyCertificate,
} = require("../middlewares/upload.middleware");

const router = express.Router();

router.get("/", getCompanies);
router.get("/searchByname", searchCompaniesByName);
router.get("/by-name", getCompaniesByNameFromCompanyTable);

router.post(
  "/pending",
  verifyToken,
  uploadPendingCompanyFiles,
  createPendingCompanyRequest
);

router.post(
  "/pending/update",
  verifyToken,
  uploadPendingCompanyFiles,
  createPendingCompanyUpdateRequest
);

router.get("/pending", verifyToken, getPendingCompaniesWaitingConfirmation);
router.get("/pending/me", verifyToken, getMyPendingCompanies);

router.patch(
  "/pending/:pendingCompanyId/approve",
  verifyToken,
  approvePendingCompanyRequest
);

router.patch(
  "/pending/:pendingCompanyId/reject",
  verifyToken,
  rejectPendingCompanyRequest
);

router.put(
  "/pending/:pendingCompanyId/reject",
  verifyToken,
  rejectPendingCompanyRequest
);

router.patch(
  "/pending/certificate",
  verifyToken,
  uploadPendingCompanyCertificate,
  updatePendingCompanyCertificate
);

router.put(
  "/pending/certificate",
  verifyToken,
  uploadPendingCompanyCertificate,
  updatePendingCompanyCertificate
);

router.patch(
  "/pending/:pendingCompanyId",
  verifyToken,
  uploadPendingCompanyFiles,
  updatePendingCompanyRequest
);

router.put(
  "/pending/:pendingCompanyId",
  verifyToken,
  uploadPendingCompanyFiles,
  updatePendingCompanyRequest
);

router.get("/profile/me", verifyToken, getMyCompany);
router.get("/profile/:companyId", getCompanyDetail);

// Admin cập nhật trực tiếp thông tin công ty
router.patch(
  "/:companyId",
  verifyToken,
  uploadPendingCompanyFiles,
  updateCompanyRequest
);

router.put(
  "/:companyId",
  verifyToken,
  uploadPendingCompanyFiles,
  updateCompanyRequest
);

module.exports = router;