const {
  getAllCompanies,
  getCompanyById,
  getCompanyByRecruiterUserId,
} = require("../models/company.model");

const isValidId = (value) => {
  return /^\d+$/.test(String(value || ""));
};

const getCompanies = async (req, res) => {
  try {
    const companies = await getAllCompanies();

    return res.status(200).json({
      success: true,
      message: "Lay danh sach cong ty thanh cong.",
      data: {
        companies,
      },
    });
  } catch (error) {
    console.error("Loi lay danh sach cong ty:", error);

    return res.status(500).json({
      success: false,
      message: "Loi server. Vui long thu lai sau.",
      error: error.message,
    });
  }
};

const getCompanyDetail = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!isValidId(companyId)) {
      return res.status(400).json({
        success: false,
        message: "companyId khong hop le.",
      });
    }

    const company = await getCompanyById(companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Khong tim thay thong tin cong ty.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lay thong tin cong ty thanh cong.",
      data: {
        company,
      },
    });
  } catch (error) {
    console.error("Loi lay thong tin cong ty:", error);

    return res.status(500).json({
      success: false,
      message: "Loi server. Vui long thu lai sau.",
      error: error.message,
    });
  }
};

const getMyCompany = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Khong tim thay thong tin nguoi dung.",
      });
    }

    if (role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Tai khoan cua ban khong co quyen truy cap thong tin nay.",
      });
    }

    const company = await getCompanyByRecruiterUserId(userId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Nha tuyen dung chua lien ket voi cong ty.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lay thong tin cong ty thanh cong.",
      data: {
        company,
      },
    });
  } catch (error) {
    console.error("Loi lay thong tin cong ty cua recruiter:", error);

    return res.status(500).json({
      success: false,
      message: "Loi server. Vui long thu lai sau.",
      error: error.message,
    });
  }
};

module.exports = {
  getCompanies,
  getCompanyDetail,
  getMyCompany,
};
