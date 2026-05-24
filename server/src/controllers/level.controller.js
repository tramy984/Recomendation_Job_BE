const { getAllLevels } = require("../models/level.model");

const getLevels = async (_req, res) => {
  try {
    const levels = await getAllLevels();

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách cấp độ thành công.",
      data: {
        levels,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách cấp độ:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

module.exports = {
  getLevels,
};
