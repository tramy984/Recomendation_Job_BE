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
        message: "Chỉ admin mới có quyền cập nhật trạng thái tài khoản.",
      });
    }

    const { userId } = req.params;

    if (!isValidId(userId)) {
      return res.status(400).json({
        success: false,
        message: "userId không hợp lệ.",
      });
    }

    if (Number(userId) === Number(req.user?.id) && status === false) {
      return res.status(400).json({
        success: false,
        message: "Không thể khóa chính tài khoản đang đăng nhập.",
      });
    }

    const currentUser = await getUserByIdWithFullName(userId);

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản.",
      });
    }

    const user = await updateUserStatusById(userId, status);

    return res.status(200).json({
      success: true,
      message: status
        ? "Mở tài khoản thành công."
        : "Khóa tài khoản thành công.",
      data: {
        user,
      },
    });
  } catch (error) {
    console.error("Lỗi cập nhật trạng thái tài khoản:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ. Vui lòng thử lại sau.",
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
        message: "Chỉ admin mới có quyền xem dashboard.",
      });
    }

    const year = normalizeYear(req.query.year);

    if (!year) {
      return res.status(400).json({
        success: false,
        message: "year không hợp lệ.",
      });
    }

    const dashboard = await getAdminDashboard(year);

    return res.status(200).json({
      success: true,
      message: "Lấy dữ liệu dashboard thành công.",
      data: dashboard,
    });
  } catch (error) {
    console.error("Lỗi lấy dữ liệu dashboard:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const getAccounts = async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Chỉ admin mới có quyền xem danh sách tài khoản.",
      });
    }

    const users = await getAllUsersWithFullName();

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách tài khoản thành công.",
      data: {
        users,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách tài khoản:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ. Vui lòng thử lại sau.",
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
