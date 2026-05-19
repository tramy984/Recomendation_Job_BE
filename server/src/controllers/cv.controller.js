const fs = require("fs");
const path = require("path");

const {
  findCandidateIdByUserId,
  countCVByCandidateId,
  findCVsByCandidateId,
  createCV,
  setDefaultCV,
  deleteCVByIdAndCandidateId,
} = require("../models/cv.model");

const removeOldFile = (fileUrl) => {
  if (!fileUrl) return;

  const relativePath = fileUrl.replace(/^\/+/, "");
  const fullPath = path.join(__dirname, "../../", relativePath);

  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
};

const getMyCVs = async (req, res) => {
  try {
    const userId = req.user.id;

    const candidateId = await findCandidateIdByUserId(userId);

    if (!candidateId) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    const cvs = await findCVsByCandidateId(candidateId);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách CV thành công.",
      data: cvs,
    });
  } catch (error) {
    console.log("GET MY CVS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Lấy danh sách CV thất bại.",
    });
  }
};

const uploadMyCV = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn file CV.",
      });
    }

    const candidateId = await findCandidateIdByUserId(userId);

    if (!candidateId) {
      removeOldFile(`/uploads/cvs/${req.file.filename}`);

      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    const totalCV = await countCVByCandidateId(candidateId);

    if (totalCV >= 5) {
      removeOldFile(`/uploads/cvs/${req.file.filename}`);

      return res.status(400).json({
        success: false,
        message: "Bạn chỉ được lưu tối đa 5 CV.",
      });
    }

    const fileUrl = `/uploads/cvs/${req.file.filename}`;

    const cv = await createCV({
      candidateId,
      fileUrl,
      isDefault: totalCV === 0,
    });

    return res.status(201).json({
      success: true,
      message:
        totalCV === 0
          ? "Lưu CV thành công. CV này đã được đặt làm mặc định."
          : "Lưu CV thành công.",
      data: cv,
    });
  } catch (error) {
    console.log("UPLOAD MY CV ERROR:", error);

    if (req.file) {
      removeOldFile(`/uploads/cvs/${req.file.filename}`);
    }

    return res.status(500).json({
      success: false,
      message: "Lưu CV thất bại.",
    });
  }
};

const setMyDefaultCV = async (req, res) => {
  try {
    const userId = req.user.id;
    const { cvId } = req.params;

    const candidateId = await findCandidateIdByUserId(userId);

    if (!candidateId) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    const cv = await setDefaultCV({
      candidateId,
      cvId,
    });

    if (!cv) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy CV.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Đặt CV mặc định thành công.",
      data: cv,
    });
  } catch (error) {
    console.log("SET DEFAULT CV ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Đặt CV mặc định thất bại.",
    });
  }
};

const deleteMyCV = async (req, res) => {
  try {
    const userId = req.user.id;
    const { cvId } = req.params;

    const candidateId = await findCandidateIdByUserId(userId);

    if (!candidateId) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    const deletedCV = await deleteCVByIdAndCandidateId({
      cvId,
      candidateId,
    });

    if (!deletedCV) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy CV.",
      });
    }

    removeOldFile(deletedCV.file_url);

    return res.status(200).json({
      success: true,
      message: "Xóa CV thành công.",
      data: deletedCV,
    });
  } catch (error) {
    console.log("DELETE MY CV ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Xóa CV thất bại.",
    });
  }
};

module.exports = {
  getMyCVs,
  uploadMyCV,
  setMyDefaultCV,
  deleteMyCV,
};
