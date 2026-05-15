const {
  getRecruiterByUserId,
} = require("../models/recruiter.model");

const getMyRecruiterProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Không tìm thấy thông tin người dùng.",
      });
    }

    if (role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản của bạn không có quyền truy cập thông tin này",
      });
    }

    const recruiter = await getRecruiterByUserId(userId);

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin người dùng.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lấy thông tin người dùng thành công",
      data: {
        recruiter,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy thông tin nhà tuyển dụng:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau",
      error: error.message,
    });
  }
};

module.exports = {
  getMyRecruiterProfile,
};
