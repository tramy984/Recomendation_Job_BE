const { getHomepageStats } = require("../models/homepage.model");

const getStats = async (_req, res) => {
  try {
    const stats = await getHomepageStats();

    return res.status(200).json({
      success: true,
      message: "Lấy thống kê trang chủ thành công.",
      data: stats,
    });
  } catch (error) {
    console.error("Lỗi lấy thống kê trang chủ:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

module.exports = {
  getStats,
};
