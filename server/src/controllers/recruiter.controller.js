const fs = require("fs");
const path = require("path");

const {
  getRecruiterByUserId,
  updateRecruiterById,
} = require("../models/recruiter.model");

const recruiterUploadDir = path.join(__dirname, "../../uploads/recruiters");

const getUploadedFileUrl = (req, file) => {
  return `/uploads/recruiters/${file.filename}`;
};

const getPublicAvatarUrl = (req, avatar) => {
  if (!avatar) return null;

  const uploadPath = getUploadPathFromAvatar(avatar);

  if (uploadPath) {
    return `${req.protocol}://${req.get("host")}${uploadPath}`;
  }

  return avatar;
};

const formatRecruiterResponse = (req, recruiter) => {
  if (!recruiter) return null;

  return {
    ...recruiter,
    avatar: getPublicAvatarUrl(req, recruiter.avatar),
  };
};

const getUploadPathFromAvatar = (avatar) => {
  if (!avatar || typeof avatar !== "string") return null;

  if (avatar.startsWith("/uploads/recruiters/")) {
    return avatar;
  }

  try {
    const url = new URL(avatar);
    return url.pathname.startsWith("/uploads/recruiters/")
      ? url.pathname
      : null;
  } catch (error) {
    return null;
  }
};

const deleteRecruiterAvatarFile = async (avatar) => {
  const uploadPath = getUploadPathFromAvatar(avatar);

  if (!uploadPath) return;

  const filename = path.basename(uploadPath);
  const filePath = path.join(recruiterUploadDir, filename);
  const resolvedFilePath = path.resolve(filePath);
  const resolvedUploadDir = path.resolve(recruiterUploadDir);

  if (!resolvedFilePath.startsWith(resolvedUploadDir + path.sep)) return;

  try {
    await fs.promises.unlink(resolvedFilePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Loi xoa avatar cu:", error);
    }
  }
};

const getUpdateData = (body = {}) => {
  if (body.recruiter) return { ...body.recruiter };

  if (!body.data) return { ...body };

  if (typeof body.data === "string") {
    try {
      const parsedData = JSON.parse(body.data);
      return parsedData.recruiter ? { ...parsedData.recruiter } : parsedData;
    } catch (error) {
      return {};
    }
  }

  if (body.data.recruiter) return { ...body.data.recruiter };

  return { ...body.data };
};

const hasUpdatableRecruiterField = (updateData = {}) => {
  const updateFields = [
    "fullName",
    "full_name",
    "name",
    "phone",
    "gender",
    "location",
    "dateOfBirth",
    "date_of_birth",
    "avatar",
    "certificate",
    "status",
    "companyId",
    "company_id",
    "isVerifyPhone",
    "is_verify_phone",
  ];

  return updateFields.some((field) =>
    Object.prototype.hasOwnProperty.call(updateData, field)
  );
};

const normalizeOptionalFields = (updateData) => {
  if (updateData.gender === "true") updateData.gender = true;
  if (updateData.gender === "false") updateData.gender = false;
  if (updateData.gender === "") updateData.gender = null;

  if (updateData.dateOfBirth === "") {
    updateData.dateOfBirth = null;
  }

  if (updateData.date_of_birth === "") {
    updateData.date_of_birth = null;
  }

  if (
    updateData.avatar === "" ||
    updateData.avatar === "null" ||
    updateData.avatar === null
  ) {
    updateData.avatar = null;
  }
};

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
        message:
          "Tài khoản của bạn không có quyền truy cập thông tin này.",
      });
    }

    const recruiter = await getRecruiterByUserId(userId);

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin nhà tuyển dụng.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lấy thông tin nhà tuyển dụng thành công.",
      data: {
        recruiter: formatRecruiterResponse(req, recruiter),
      },
    });
  } catch (error) {
    console.error(
      "Lỗi lấy thông tin nhà tuyển dụng:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const updateMyRecruiterProfile = async (req, res) => {
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
        message:
          "Tài khoản của bạn không có quyền cập nhật thông tin này.",
      });
    }

    const recruiter = await getRecruiterByUserId(userId);

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy nhà tuyển dụng.",
      });
    }

    const updateData = getUpdateData(req.body);
    const oldAvatar = recruiter.avatar;
    const shouldDeleteOldAvatar =
      Boolean(req.file) ||
      updateData.removeAvatar === "true" ||
      updateData.removeAvatar === true ||
      updateData.avatar === null ||
      updateData.avatar === "";

    if (req.file) {
      updateData.avatar = getUploadedFileUrl(req, req.file);
    }

    if (
      updateData.removeAvatar === "true" ||
      updateData.removeAvatar === true
    ) {
      updateData.avatar = null;
    }

    delete updateData.removeAvatar;

    normalizeOptionalFields(updateData);

    if (!hasUpdatableRecruiterField(updateData)) {
      if (req.file) {
        await deleteRecruiterAvatarFile(getUploadedFileUrl(req, req.file));
      }

      return res.status(400).json({
        success: false,
        message: "Không có dữ liệu để cập nhật.",
      });
    }

    const nextName =
      updateData.name ??
      updateData.fullName ??
      updateData.full_name;

    if (typeof nextName === "string") {
      const trimmedName = nextName.trim();

      if (trimmedName.length < 3) {
        if (req.file) {
          await deleteRecruiterAvatarFile(getUploadedFileUrl(req, req.file));
        }

        return res.status(400).json({
          success: false,
          message: "Tên phải có ít nhất 3 ký tự.",
        });
      }

      updateData.fullName = trimmedName;

      delete updateData.name;
      delete updateData.full_name;
    }

    const updatedRecruiter = await updateRecruiterById(
      recruiter.id,
      updateData
    );

    if (updatedRecruiter && shouldDeleteOldAvatar) {
      await deleteRecruiterAvatarFile(oldAvatar);
    }

    return res.status(200).json({
      success: true,
      message:
        "Cập nhật thông tin nhà tuyển dụng thành công.",
      data: {
        recruiter: formatRecruiterResponse(req, updatedRecruiter),
      },
    });
  } catch (error) {
    if (req.file) {
      await deleteRecruiterAvatarFile(getUploadedFileUrl(req, req.file));
    }

    console.error("Lỗi cập nhật recruiter:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

module.exports = {
  getMyRecruiterProfile,
  updateMyRecruiterProfile,
};
