const { getAllLevels } = require("../models/level.model");

const getLevels = async (_req, res) => {
  try {
    const levels = await getAllLevels();

    return res.status(200).json({
      success: true,
      message: "Lay danh sach cap do thanh cong.",
      data: {
        levels,
      },
    });
  } catch (error) {
    console.error("Loi lay danh sach cap do:", error);

    return res.status(500).json({
      success: false,
      message: "Loi server. Vui long thu lai sau.",
      error: error.message,
    });
  }
};

module.exports = {
  getLevels,
};
