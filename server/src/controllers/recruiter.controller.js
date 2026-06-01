const fs = require("fs");
const path = require("path");

const {
  getRecruiterById,
  getRecruiterDashboardStatistics,
  getRecruiterByUserId,
  getRecruiterPostingChecklistByUserId,
  updateRecruiterById,
} = require("../models/recruiter.model");
const {
  deleteFileFromStorage,
  uploadFileToStorage,
} = require("../services/storage.service");

const recruiterUploadDir = path.join(__dirname, "../../uploads/recruiters");

const removeLocalUploadedFile = async (file) => {
  if (!file?.path) return;

  try {
    await fs.promises.unlink(file.path);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("DELETE LOCAL UPLOAD ERROR:", error);
    }
  }
};

const saveRecruiterAvatarFile = async (file, recruiterId) => {
  if (!file) return null;

  const fileUrl = await uploadFileToStorage({
    file,
    folder: `recruiter-avatars/${recruiterId}`,
  });

  await removeLocalUploadedFile(file);

  return fileUrl;
};

const getPublicAvatarUrl = (req, avatar) => {
  if (!avatar) return null;

  const uploadPath = getUploadPathFromAvatar(avatar);

  if (uploadPath) {
    return `${req.protocol}://${req.get("host")}${uploadPath}`;
  }

  return avatar;
};

const getPublicFileUrl = (req, value) => {
  if (!value || typeof value !== "string") return value || null;

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/uploads/")) {
    return `${req.protocol}://${req.get("host")}${value}`;
  }

  return value;
};

const formatCompanyResponse = (req, company) => {
  if (!company) return null;

  return {
    ...company,
    logo: getPublicFileUrl(req, company.logo),
    certificate: getPublicFileUrl(req, company.certificate),
  };
};

const formatDateOnly = (value) => {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  if (typeof value === "string") {
    const [datePart] = value.split("T");

    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return datePart;
    }
  }

  return value;
};

const formatRecruiterResponse = (req, recruiter) => {
  if (!recruiter) return null;

  return {
    ...recruiter,
    date_of_birth: formatDateOnly(recruiter.date_of_birth),
    avatar: getPublicAvatarUrl(req, recruiter.avatar),
    company: formatCompanyResponse(req, recruiter.company),
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
  if (await deleteFileFromStorage(avatar)) return;

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
      console.error("Lỗi xóa avatar cũ:", error);
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
    "companyId",
    "company_id",
  ];

  return updateFields.some((field) =>
    Object.prototype.hasOwnProperty.call(updateData, field)
  );
};

const normalizePhoneNumber = (phone) => {
  if (typeof phone !== "string") return null;

  const compactPhone = phone.replace(/[\s().-]/g, "");

  if (/^0\d{9}$/.test(compactPhone)) {
    return `+84${compactPhone.slice(1)}`;
  }

  if (/^84\d{9}$/.test(compactPhone)) {
    return `+${compactPhone}`;
  }

  if (/^\+84\d{9}$/.test(compactPhone)) {
    return compactPhone;
  }

  return null;
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

const isValidId = (value) => {
  return /^\d+$/.test(String(value || ""));
};

const parseStatisticsFilters = (query = {}) => {
  const filters = {};

  if (query.year !== undefined && query.year !== "") {
    if (!/^\d{4}$/.test(String(query.year))) {
      return {
        error: "Nam thong ke khong hop le.",
      };
    }

    filters.year = Number(query.year);
  }

  if (query.month !== undefined && query.month !== "") {
    if (!/^\d{1,2}$/.test(String(query.month))) {
      return {
        error: "Thang thong ke khong hop le.",
      };
    }

    filters.month = Number(query.month);

    if (filters.month < 1 || filters.month > 12) {
      return {
        error: "Thang thong ke phai tu 1 den 12.",
      };
    }

    if (!filters.year) {
      return {
        error: "Thang thong ke can di kem nam thong ke.",
      };
    }
  }

  return {
    filters,
  };
};

const getMyRecruiterStatistics = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Ban chua dang nhap.",
      });
    }

    if (role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Chi nha tuyen dung moi co quyen xem thong ke nay.",
      });
    }

    const { filters, error } = parseStatisticsFilters(req.query);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    const recruiter = await getRecruiterByUserId(userId);

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Khong tim thay thong tin nha tuyen dung.",
      });
    }

    const statistics = await getRecruiterDashboardStatistics(
      recruiter.id,
      filters
    );

    return res.status(200).json({
      success: true,
      message: "Lay thong ke nha tuyen dung thanh cong.",
      data: {
        recruiterId: recruiter.id,
        companyId: recruiter.company_id,
        filters,
        ...statistics,
        passedCvStatus: "approved",
      },
    });
  } catch (error) {
    console.error("Loi lay thong ke nha tuyen dung:", error);

    return res.status(500).json({
      success: false,
      message: "Loi server. Vui long thu lai sau.",
      error: error.message,
    });
  }
};

const getRecruiterDetail = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const { recruiterId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập.",
      });
    }

    if (role !== "recruiter" && role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xem thông tin nhà tuyển dụng.",
      });
    }

    if (!isValidId(recruiterId)) {
      return res.status(400).json({
        success: false,
        message: "recruiterId không hợp lệ.",
      });
    }

    if (role === "recruiter") {
      const currentRecruiter = await getRecruiterByUserId(userId);

      if (!currentRecruiter) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy thông tin nhà tuyển dụng.",
        });
      }

      if (Number(currentRecruiter.id) !== Number(recruiterId)) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền xem thông tin nhà tuyển dụng này.",
        });
      }
    }

    const recruiter = await getRecruiterById(recruiterId);

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
    console.error("Lỗi lấy thông tin nhà tuyển dụng:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
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

const getMyRecruiterPostingChecklist = async (req, res) => {
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
        message: "Tài khoản của bạn không có quyền truy cập thông tin này.",
      });
    }

    const checklist = await getRecruiterPostingChecklistByUserId(userId);

    if (!checklist) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin nhà tuyển dụng.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lấy trạng thái đăng bài của nhà tuyển dụng thành công.",
      data: {
        isVerifyPhone: Boolean(checklist.is_verify_phone),
        hasCompanyInfo: Boolean(checklist.has_company_info),
        isCertificateApproved: Boolean(
          checklist.is_certificate_approved
        ),
      },
    });
  } catch (error) {
    console.error("Lỗi lấy trạng thái đăng bài của recruiter:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const updateMyRecruiterProfile = async (req, res) => {
  let uploadedAvatar = null;

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
    delete updateData.isVerifyPhone;
    delete updateData.is_verify_phone;
    delete updateData.status;

    const oldAvatar = recruiter.avatar;
    const shouldDeleteOldAvatar =
      Boolean(req.file) ||
      updateData.removeAvatar === "true" ||
      updateData.removeAvatar === true ||
      updateData.avatar === null ||
      updateData.avatar === "";

    if (req.file) {
      uploadedAvatar = await saveRecruiterAvatarFile(req.file, recruiter.id);
      updateData.avatar = uploadedAvatar;
    }

    if (
      updateData.removeAvatar === "true" ||
      updateData.removeAvatar === true
    ) {
      updateData.avatar = null;
    }

    delete updateData.removeAvatar;

    normalizeOptionalFields(updateData);

    if (Object.prototype.hasOwnProperty.call(updateData, "phone")) {
      if (updateData.phone === "" || updateData.phone === null) {
        updateData.phone = null;
        updateData.isVerifyPhone = false;
      } else {
        const normalizedPhone = normalizePhoneNumber(updateData.phone);

        if (!normalizedPhone) {
          if (uploadedAvatar) {
            await deleteRecruiterAvatarFile(uploadedAvatar);
          }

          return res.status(400).json({
            success: false,
            message: "Số điện thoại không hợp lệ",
          });
        }

        updateData.phone = normalizedPhone;

        if (normalizedPhone !== recruiter.phone) {
          updateData.isVerifyPhone = false;
        }
      }
    }

    if (!hasUpdatableRecruiterField(updateData)) {
      if (uploadedAvatar) {
        await deleteRecruiterAvatarFile(uploadedAvatar);
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
        if (uploadedAvatar) {
          await deleteRecruiterAvatarFile(uploadedAvatar);
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
    if (uploadedAvatar) {
      await deleteRecruiterAvatarFile(uploadedAvatar);
    } else if (req.file) {
      await removeLocalUploadedFile(req.file);
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
  getRecruiterDetail,
  getMyRecruiterStatistics,
  getMyRecruiterProfile,
  getMyRecruiterPostingChecklist,
  updateMyRecruiterProfile,
};
