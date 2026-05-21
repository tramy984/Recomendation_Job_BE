const { getHomepageStats } = require("../models/homepage.model");

const getStats = async (_req, res) => {
  try {
    const stats = await getHomepageStats();

    return res.status(200).json({
      success: true,
      message: "Lay thong ke homepage thanh cong.",
      data: stats,
    });
  } catch (error) {
    console.error("Loi lay thong ke homepage:", error);

    return res.status(500).json({
      success: false,
      message: "Loi may chu. Vui long thu lai sau.",
      error: error.message,
    });
  }
};

module.exports = {
  getStats,
};
