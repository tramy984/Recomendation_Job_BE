const express = require("express");

const {
  createPendingCompanyRequest,
  getCompanies,
  getCompanyDetail,
  getMyPendingCompanies,
  getMyCompany,
  searchCompaniesByName,
  updatePendingCompanyCertificate,
  updatePendingCompanyRequest,
} = require("../controllers/company.controller");
const { verifyToken } = require("../middlewares/auth.middleware");
const {
  uploadPendingCompanyCertificate,
} = require("../middlewares/upload.middleware");

const router = express.Router();

router.get("/", getCompanies);
router.get("/searchByname", searchCompaniesByName);
router.post("/pending", verifyToken, createPendingCompanyRequest);
router.get("/pending/me", verifyToken, getMyPendingCompanies);
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
router.patch("/pending/:pendingCompanyId", verifyToken, updatePendingCompanyRequest);
router.put("/pending/:pendingCompanyId", verifyToken, updatePendingCompanyRequest);
router.get("/profile/me", verifyToken, getMyCompany);
router.get("/profile/:companyId", getCompanyDetail);

module.exports = router;
