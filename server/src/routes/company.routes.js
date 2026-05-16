const express = require("express");

const {
  getCompanies,
  getCompanyDetail,
  getMyCompany,
} = require("../controllers/company.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", getCompanies);
router.get("/profile/me", verifyToken, getMyCompany);
router.get("/profile/:companyId", getCompanyDetail);

module.exports = router;
