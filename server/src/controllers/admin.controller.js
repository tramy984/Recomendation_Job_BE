const {
  getAdminDashboard,
} = require("../models/admin_dashboard.model");
const {
  getAllUsersWithFullName,
  getUserByIdWithFullName,
  updateUserStatusById,
} = require("../models/user.model");

const normalizeYear = (value) => {
  if (value === undefined || value === null || value === "") {
    return new Date().getFullYear();
  }

  const year = Number(value);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return null;
  }

  return year;
};

const isValidId = (value) => {
  return /^\d+$/.test(String(value || ""));
};

const updateAccountStatus = async (req, res, status) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Chi admin moi co quyen cap nhat trang thai tai khoan.",
      });
    }

    const { userId } = req.params;

    if (!isValidId(userId)) {
      return res.status(400).json({
        success: false,
        message: "userId khong hop le.",
      });
    }

    if (Number(userId) === Number(req.user?.id) && status === false) {
      return res.status(400).json({
        success: false,
        message: "Khong the khoa chinh tai khoan dang dang nhap.",
      });
    }

    const currentUser = await getUserByIdWithFullName(userId);

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "Khong tim thay tai khoan.",
      });
    }

    const user = await updateUserStatusById(userId, status);

    return res.status(200).json({
      success: true,
      message: status
        ? "Mo tai khoan thanh cong."
        : "Khoa tai khoan thanh cong.",
      data: {
        user,
      },
    });
  } catch (error) {
    console.error("Loi cap nhat trang thai tai khoan:", error);

    return res.status(500).json({
      success: false,
      message: "Loi may chu. Vui long thu lai sau.",
      error: error.message,
    });
  }
};

const lockAccount = async (req, res) => {
  return updateAccountStatus(req, res, false);
};

const unlockAccount = async (req, res) => {
  return updateAccountStatus(req, res, true);
};

const getDashboard = async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Chi admin moi co quyen xem dashboard.",
      });
    }

    const year = normalizeYear(req.query.year);

    if (!year) {
      return res.status(400).json({
        success: false,
        message: "year khong hop le.",
      });
    }

    const dashboard = await getAdminDashboard(year);

    return res.status(200).json({
      success: true,
      message: "Lay du lieu dashboard thanh cong.",
      data: dashboard,
    });
  } catch (error) {
    console.error("Loi lay du lieu dashboard:", error);

    return res.status(500).json({
      success: false,
      message: "Loi may chu. Vui long thu lai sau.",
      error: error.message,
    });
  }
};

const getAccounts = async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Chi admin moi co quyen xem danh sach tai khoan.",
      });
    }

    const users = await getAllUsersWithFullName();

    return res.status(200).json({
      success: true,
      message: "Lay danh sach tai khoan thanh cong.",
      data: {
        users,
      },
    });
  } catch (error) {
    console.error("Loi lay danh sach tai khoan:", error);

    return res.status(500).json({
      success: false,
      message: "Loi may chu. Vui long thu lai sau.",
      error: error.message,
    });
  }
};

module.exports = {
  getAccounts,
  getDashboard,
  lockAccount,
  unlockAccount,
};
