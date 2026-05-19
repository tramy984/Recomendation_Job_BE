const {
  findCandidateByUserId,
  updateCandidateByUserId,
} = require("../models/candidate.model");

const getMyCandidate = async (req, res) => {
  try {
    const userId = req.user.id;

    const candidate = await findCandidateByUserId(userId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lấy candidate thành công.",
      data: candidate,
    });
  } catch (error) {
    console.log("GET MY CANDIDATE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
};

const updateMyCandidate = async (req, res) => {
  try {
    const userId = req.user.id;

    const { fullName, phone, location, gender, dateOfBirth, removeAvatar } =
      req.body;

    let avatar;
    let updateAvatar = false;

    if (req.file) {
      avatar = `/uploads/candidates/${req.file.filename}`;
      updateAvatar = true;
    }

    if (removeAvatar === "true") {
      avatar = null;
      updateAvatar = true;
    }

    const candidate = await updateCandidateByUserId({
      userId,
      fullName,
      phone,
      location,
      gender,
      dateOfBirth,
      avatar,
      updateAvatar,
    });

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cập nhật thông tin thành công.",
      data: candidate,
    });
  } catch (error) {
    console.log("UPDATE MY CANDIDATE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Cập nhật thông tin thất bại.",
    });
  }
};

module.exports = {
  getMyCandidate,
  updateMyCandidate,
};
