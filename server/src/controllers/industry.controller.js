const { getAllIndustries } = require("../models/industry.model");

const getIndustries = async (_req, res) => {
  try {
    const industries = await getAllIndustries();

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách lĩnh vực thành công.",
      data: {
        industries,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách lĩnh vực:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

module.exports = {
  getIndustries,
};