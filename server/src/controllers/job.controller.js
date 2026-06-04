const {
  createJob,
  getApplicationById,
  getAllJobTypes,
  getJobApplicationsByJobId,
  getJobById,
  getJobsByCompanyId,
  getJobsByRecruiterId,
  updateApplicationReviewById,
  updateExpiredJobsStatus,
  updateJobExpireById,
  updateJobStatusById,
  updateJobById,
} = require("../models/job.model");
const { getRecruiterByUserId } = require("../models/recruiter.model");
const {
  notifyApplicationReviewed,
} = require("../services/notification.service");
const { syncJobToAI } = require("../services/job_ai.service");

const getJobPayload = (body = {}) => {
  if (body.job) return { ...body.job };

  if (!body.data) return { ...body };

  if (typeof body.data === "string") {
    try {
      const parsedData = JSON.parse(body.data);

      return parsedData.job ? { ...parsedData.job } : parsedData;
    } catch (error) {
      return {};
    }
  }

  if (body.data.job) {
    return { ...body.data.job };
  }

  return { ...body.data };
};

const getApplicationPayload = (body = {}) => {
  if (body.application) return { ...body.application };

  if (!body.data) return { ...body };

  if (typeof body.data === "string") {
    try {
      const parsedData = JSON.parse(body.data);

      return parsedData.application
        ? { ...parsedData.application }
        : parsedData;
    } catch (error) {
      return {};
    }
  }

  if (body.data.application) {
    return { ...body.data.application };
  }

  return { ...body.data };
};

const hasOwn = (data, key) => {
  return Object.prototype.hasOwnProperty.call(data, key);
};

const hasAnyOwn = (data, keys) => {
  return keys.some((key) => hasOwn(data, key));
};

const readAlias = (data, keys) => {
  const key = keys.find((fieldKey) => hasOwn(data, fieldKey));

  return key ? data[key] : undefined;
};

const isValidId = (value) => {
  return /^\d+$/.test(String(value || ""));
};

const normalizeIndustryIds = (value) => {
  const rawIds = Array.isArray(value) ? value : [value];

  return [
    ...new Set(
      rawIds
        .flatMap((item) => {
          if (typeof item === "string") return item.split(",");
          return [item];
        })
        .map((item) => String(item || "").trim())
        .filter(isValidId)
        .map(Number),
    ),
  ];
};

const normalizeText = (value) => {
  if (typeof value !== "string") {
    return value ?? null;
  }

  const trimmedValue = value.trim();

  return trimmedValue || null;
};

const normalizeBigInt = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }

  return undefined;
};

const normalizeDecimal = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      return null;
    }

    if (/^\d+(\.\d+)?$/.test(normalizedValue)) {
      return Number(normalizedValue);
    }
  }

  return undefined;
};

const normalizeTimestamp = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date;
};

const getCompanyJobFilters = (query = {}) => {
  const name = normalizeText(readAlias(query, ["name", "keyword", "q"]));

  const status = hasOwn(query, "status")
    ? normalizeBigInt(query.status)
    : undefined;

  const industryKeys = [
    "industryIds",
    "industry_ids",
    "industryId",
    "industry_id",
  ];

  const industryValue = readAlias(query, ["industry"]);
  const hasIndustryIds = hasAnyOwn(query, industryKeys);
  const industryIds =
    hasIndustryIds || isValidId(industryValue)
      ? normalizeIndustryIds(
          hasIndustryIds ? readAlias(query, industryKeys) : industryValue,
        )
      : [];
  const industryName =
    hasIndustryIds || isValidId(industryValue)
      ? normalizeText(readAlias(query, ["industryName", "industry_name"]))
      : normalizeText(
          readAlias(query, ["industry", "industryName", "industry_name"]),
        );

  if (status === null || (status === undefined && hasOwn(query, "status"))) {
    return {
      error: "Trạng thái không hợp lệ.",
    };
  }

  if (hasIndustryIds && industryIds.length === 0) {
    return {
      error: "Lĩnh vực công việc không hợp lệ.",
    };
  }

  return {
    filters: {
      name,
      status,
      industryIds,
      industryName,
    },
  };
};

const getJobTypes = async (_req, res) => {
  try {
    const jobTypes = await getAllJobTypes();

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách hình thức làm việc thành công.",
      data: {
        jobTypes,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách hình thức làm việc:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const getJobDetailRequest = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!isValidId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "jobId không hợp lệ.",
      });
    }

    const job = await getJobById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin tuyển dụng.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lấy thông tin chi tiết tin tuyển dụng thành công.",
      data: {
        job,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy thông tin chi tiết tin tuyển dụng:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const getJobApplicationsRequest = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const { jobId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập.",
      });
    }

    if (role !== "recruiter" && role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xem danh sách ứng viên của tin này.",
      });
    }

    if (!isValidId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "jobId không hợp lệ.",
      });
    }

    const job = await getJobById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin tuyển dụng.",
      });
    }

    if (role === "recruiter") {
      const recruiter = await getRecruiterByUserId(userId);

      if (!recruiter) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy thông tin nhà tuyển dụng.",
        });
      }

      if (!recruiter.company_id) {
        return res.status(400).json({
          success: false,
          message: "Nhà tuyển dụng chưa liên kết công ty.",
        });
      }

      if (Number(job.company_id) !== Number(recruiter.company_id)) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền xem danh sách ứng viên của tin này.",
        });
      }
    }

    const applications = await getJobApplicationsByJobId(job.id);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách ứng viên của tin tuyển dụng thành công.",
      data: {
        jobId: job.id,
        total: applications.length,
        applications,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách ứng viên của tin tuyển dụng:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const getReviewableApplication = async ({
  applicationId,
  userId,
  role,
  actionName,
}) => {
  if (!userId) {
    return {
      statusCode: 401,
      response: {
        success: false,
        message: "Bạn chưa đăng nhập.",
      },
    };
  }

  if (role !== "recruiter" && role !== "admin") {
    return {
      statusCode: 403,
      response: {
        success: false,
        message: `Bạn không có quyền ${actionName} application này.`,
      },
    };
  }

  if (!isValidId(applicationId)) {
    return {
      statusCode: 400,
      response: {
        success: false,
        message: "applicationId không hợp lệ.",
      },
    };
  }

  const application = await getApplicationById(applicationId);

  if (!application) {
    return {
      statusCode: 404,
      response: {
        success: false,
        message: "Không tìm thấy application.",
      },
    };
  }

  if (role === "admin") {
    return { application };
  }

  const recruiter = await getRecruiterByUserId(userId);

  if (!recruiter) {
    return {
      statusCode: 404,
      response: {
        success: false,
        message: "Không tìm thấy thông tin nhà tuyển dụng.",
      },
    };
  }

  if (!recruiter.company_id) {
    return {
      statusCode: 400,
      response: {
        success: false,
        message: "Nhà tuyển dụng chưa liên kết công ty.",
      },
    };
  }

  if (
    !application.job ||
    Number(application.job.company_id) !== Number(recruiter.company_id)
  ) {
    return {
      statusCode: 403,
      response: {
        success: false,
        message: `Bạn không có quyền ${actionName} application này.`,
      },
    };
  }

  return { application };
};

const approveApplicationRequest = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { application, statusCode, response } =
      await getReviewableApplication({
        applicationId,
        userId: req.user?.id,
        role: req.user?.role,
        actionName: "duyệt",
      });

    if (response) {
      return res.status(statusCode).json(response);
    }

    const updatedApplication = await updateApplicationReviewById({
      applicationId: application.id,
      status: "approved",
      reasonReject: null,
    });

    await notifyApplicationReviewed({
      senderId: req.user?.id,
      application: updatedApplication,
      isApproved: true,
    });

    return res.status(200).json({
      success: true,
      message: "Duyệt application thành công.",
      data: {
        application: updatedApplication,
      },
    });
  } catch (error) {
    console.error("Lỗi duyệt application:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const rejectApplicationRequest = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { application, statusCode, response } =
      await getReviewableApplication({
        applicationId,
        userId: req.user?.id,
        role: req.user?.role,
        actionName: "từ chối",
      });

    if (response) {
      return res.status(statusCode).json(response);
    }

    const payload = getApplicationPayload(req.body);
    const reasonReject = normalizeText(
      readAlias(payload, ["reasonReject", "reason_reject", "reason"]),
    );

    const updatedApplication = await updateApplicationReviewById({
      applicationId: application.id,
      status: "rejected",
      reasonReject,
    });

    await notifyApplicationReviewed({
      senderId: req.user?.id,
      application: updatedApplication,
      isApproved: false,
      reasonReject,
    });

    return res.status(200).json({
      success: true,
      message: "Từ chối application thành công.",
      data: {
        application: updatedApplication,
      },
    });
  } catch (error) {
    console.error("Lỗi từ chối application:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const closeMyCompanyJob = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const { jobId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập.",
      });
    }

    if (role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhà tuyển dụng mới có quyền đóng tin tuyển dụng.",
      });
    }

    if (!isValidId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "jobId không hợp lệ.",
      });
    }

    const recruiter = await getRecruiterByUserId(userId);

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin nhà tuyển dụng.",
      });
    }

    if (!recruiter.company_id) {
      return res.status(400).json({
        success: false,
        message: "Nhà tuyển dụng chưa liên kết công ty.",
      });
    }

    const job = await getJobById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin tuyển dụng.",
      });
    }

    if (Number(job.company_id) !== Number(recruiter.company_id)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền đóng tin tuyển dụng này.",
      });
    }

    if (Number(job.status) === 2) {
      return res.status(400).json({
        success: false,
        message: "Tin tuyển dụng đã hết hạn.",
      });
    }

    if (job.expire && new Date(job.expire).getTime() <= Date.now()) {
      const expiredJob = await updateJobStatusById(job.id, 2);

      return res.status(400).json({
        success: false,
        message: "Tin tuyển dụng đã hết hạn và được cập nhật status = 2.",
        data: {
          job: expiredJob,
        },
      });
    }

    const closedJob = await updateJobStatusById(job.id, 0);

    return res.status(200).json({
      success: true,
      message: "Đóng tin tuyển dụng thành công.",
      data: {
        job: closedJob,
      },
    });
  } catch (error) {
    console.error("Lỗi đóng tin tuyển dụng:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const reopenMyCompanyJob = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const { jobId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập.",
      });
    }

    if (role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhà tuyển dụng mới có quyền mở lại tin tuyển dụng.",
      });
    }

    if (!isValidId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "jobId không hợp lệ.",
      });
    }

    const recruiter = await getRecruiterByUserId(userId);

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin nhà tuyển dụng.",
      });
    }

    if (!recruiter.company_id) {
      return res.status(400).json({
        success: false,
        message: "Nhà tuyển dụng chưa liên kết công ty.",
      });
    }

    const job = await getJobById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin tuyển dụng.",
      });
    }

    if (Number(job.company_id) !== Number(recruiter.company_id)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền mở lại tin tuyển dụng này.",
      });
    }

    if (Number(job.status) === 2) {
      return res.status(400).json({
        success: false,
        message: "Tin tuyển dụng đã hết hạn.",
      });
    }

    if (job.expire && new Date(job.expire).getTime() <= Date.now()) {
      const expiredJob = await updateJobStatusById(job.id, 2);

      return res.status(400).json({
        success: false,
        message: "Tin tuyển dụng đã hết hạn và được cập nhật status = 2.",
        data: {
          job: expiredJob,
        },
      });
    }

    if (Number(job.status) !== 0) {
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể mở lại tin tuyển dụng đang đóng.",
      });
    }

    const reopenedJob = await updateJobStatusById(job.id, 1);

    return res.status(200).json({
      success: true,
      message: "Mở lại tin tuyển dụng thành công.",
      data: {
        job: reopenedJob,
      },
    });
  } catch (error) {
    console.error("Lỗi mở lại tin tuyển dụng:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const extendMyCompanyJob = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const { jobId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập.",
      });
    }

    if (role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhà tuyển dụng mới có quyền gia hạn tin tuyển dụng.",
      });
    }

    if (!isValidId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "jobId không hợp lệ.",
      });
    }

    const payload = getJobPayload(req.body);
    const expire = normalizeTimestamp(
      readAlias(payload, [
        "expire",
        "newExpire",
        "new_expire",
        "expireAt",
        "expire_at",
      ]),
    );

    if (expire === null || expire === undefined) {
      return res.status(400).json({
        success: false,
        message: "Ngày hết hạn mới không hợp lệ.",
      });
    }

    if (expire.getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        message: "Ngày hết hạn mới phải lớn hơn thời điểm hiện tại.",
      });
    }

    const recruiter = await getRecruiterByUserId(userId);

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin nhà tuyển dụng.",
      });
    }

    if (!recruiter.company_id) {
      return res.status(400).json({
        success: false,
        message: "Nhà tuyển dụng chưa liên kết công ty.",
      });
    }

    const job = await getJobById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin tuyển dụng.",
      });
    }

    if (Number(job.company_id) !== Number(recruiter.company_id)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền gia hạn tin tuyển dụng này.",
      });
    }

    const currentStatus =
      job.status === null || job.status === undefined
        ? undefined
        : Number(job.status);
    const nextStatus = currentStatus === 0 ? 0 : 1;
    const extendedJob = await updateJobExpireById(job.id, expire, nextStatus);

    return res.status(200).json({
      success: true,
      message: "Gia hạn tin tuyển dụng thành công.",
      data: {
        job: extendedJob,
      },
    });
  } catch (error) {
    console.error("Lỗi gia hạn tin tuyển dụng:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const updateExpiredJobsRequest = async (req, res) => {
  try {
    const role = req.user?.role;

    if (role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Chỉ admin mới có quyền cập nhật tin tuyển dụng hết hạn.",
      });
    }

    const expiredJobs = await updateExpiredJobsStatus();

    return res.status(200).json({
      success: true,
      message: "Cập nhật tin tuyển dụng hết hạn thành công.",
      data: {
        updatedCount: expiredJobs.length,
        jobIds: expiredJobs.map((job) => job.id),
      },
    });
  } catch (error) {
    console.error("Lỗi cập nhật tin tuyển dụng hết hạn:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const getMyCompanyJobs = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập.",
      });
    }

    if (role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message:
          "Chỉ nhà tuyển dụng mới có quyền xem tin tuyển dụng của công ty.",
      });
    }

    const recruiter = await getRecruiterByUserId(userId);

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin nhà tuyển dụng.",
      });
    }

    const { filters, error } = getCompanyJobFilters(req.query);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    const jobs = await getJobsByRecruiterId(recruiter.id, filters);

    return res.status(200).json({
      success: true,
      message: "Lay danh sach tin tuyen dung cua cong ty thanh cong.",
      data: {
        recruiterId: recruiter.id,
        companyId: recruiter.company_id,
        filters,
        jobs,
      },
    });
  } catch (error) {
    console.error("Loi lay danh sach tin tuyen dung cua cong ty:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const getCompanyJobsRequest = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!isValidId(companyId)) {
      return res.status(400).json({
        success: false,
        message: "Mã công ty không hợp lệ.",
      });
    }

    const { filters, error } = getCompanyJobFilters(req.query);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    const jobs = await getJobsByCompanyId(companyId, filters);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách tin tuyển dụng của công ty thành công.",
      data: {
        companyId: Number(companyId),
        total: jobs.length,
        filters,
        jobs,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách tin tuyển dụng theo công ty:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const createJobRequest = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập.",
      });
    }

    if (role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhà tuyển dụng mới có quyền tạo tin tuyển dụng.",
      });
    }

    const recruiter = await getRecruiterByUserId(userId);

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin nhà tuyển dụng.",
      });
    }

    if (!recruiter.company_id) {
      return res.status(400).json({
        success: false,
        message: "Nhà tuyển dụng chưa liên kết công ty.",
      });
    }

    const payload = getJobPayload(req.body);

    const name = normalizeText(payload.name);

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Tên tin tuyển dụng không được để trống.",
      });
    }

    const salaryMin = normalizeDecimal(
      readAlias(payload, ["salaryMin", "salary_min"]),
    );

    const salaryMax = normalizeDecimal(
      readAlias(payload, ["salaryMax", "salary_max"]),
    );

    const normalizedStatus = normalizeBigInt(payload.status);

    const status = normalizedStatus === null ? 1 : normalizedStatus;

    const levelId = normalizeBigInt(
      readAlias(payload, ["levelId", "idLevel", "id_level"]),
    );

    const jobTypeId = normalizeBigInt(
      readAlias(payload, ["jobTypeId", "job_type_id"]),
    );

    const candidateNumber = normalizeBigInt(
      readAlias(payload, ["candidateNumber", "candidate_number"]),
    );

    const expMin = normalizeDecimal(readAlias(payload, ["expMin", "exp_min"]));

    const expMax = normalizeDecimal(readAlias(payload, ["expMax", "exp_max"]));

    const expire = normalizeTimestamp(payload.expire);

    const industryKeys = [
      "industryIds",
      "industry_ids",
      "industryId",
      "industry_id",
    ];

    const hasIndustryIds = hasAnyOwn(payload, industryKeys);

    const industryIds = hasIndustryIds
      ? normalizeIndustryIds(readAlias(payload, industryKeys))
      : [];

    const invalidNumberFields = [
      ["Mức lương tối thiểu", salaryMin],
      ["Mức lương tối đa", salaryMax],
      ["Trạng thái", status],
      ["Cấp độ", levelId],
      ["Hình thức làm việc", jobTypeId],
      ["Số lượng tuyển", candidateNumber],
      ["Kinh nghiệm tối thiểu", expMin],
      ["Kinh nghiệm tối đa", expMax],
    ].filter(([, value]) => value === undefined);

    if (invalidNumberFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${invalidNumberFields[0][0]} không hợp lệ.`,
      });
    }

    if (hasIndustryIds && industryIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Lĩnh vực công việc không hợp lệ.",
      });
    }

    if (expire === undefined) {
      return res.status(400).json({
        success: false,
        message: "Ngày hết hạn tuyển dụng không hợp lệ.",
      });
    }

    if (
      salaryMin !== null &&
      salaryMax !== null &&
      Number(salaryMin) > Number(salaryMax)
    ) {
      return res.status(400).json({
        success: false,
        message: "Mức lương tối thiểu không được lớn hơn mức lương tối đa.",
      });
    }

    if (expMin !== null && expMax !== null && Number(expMin) > Number(expMax)) {
      return res.status(400).json({
        success: false,
        message: "Kinh nghiệm tối thiểu không được lớn hơn kinh nghiệm tối đa.",
      });
    }

    const job = await createJob({
      name,
      description: normalizeText(payload.description),
      companyId: recruiter.company_id,
      recruiterId: recruiter.id,
      salaryMin,
      salaryMax,
      status,
      expire,
      location: normalizeText(payload.location),
      levelId,
      jobTypeId,
      candidateNumber,
      expMin,
      expMax,
      industryIds,

      jobBenefit: normalizeText(
        readAlias(payload, ["jobBenefit", "job_benefit"]),
      ),

      jobRequirement: normalizeText(
        readAlias(payload, ["jobRequirement", "job_requirement"]),
      ),
    });

    await syncJobToAI({
      job,
      action: "create",
    });

    return res.status(201).json({
      success: true,
      message: "Tạo tin tuyển dụng thành công.",
      data: {
        job,
      },
    });
  } catch (error) {
    console.error("Lỗi tạo tin tuyển dụng:", error);

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Dữ liệu liên kết không hợp lệ.",
        error: error.detail || error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};

const updateJob = async (req, res) => {
  try {
    const jobId = req.params.id;

    const {
      name,
      description,
      salaryMin,
      salaryMax,
      status,
      expire,
      location,
      levelId,
      jobTypeId,
      candidateNumber,
      expMin,
      expMax,
      jobBenefit,
      jobRequirement,
      industryIds,
    } = req.body;

    const oldJob = await getJobById(jobId);

    if (!oldJob) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin tuyển dụng.",
      });
    }

    const updatedJob = await updateJobById({
      jobId,
      name,
      description,
      salaryMin,
      salaryMax,
      status,
      expire,
      location,
      levelId,
      jobTypeId,
      candidateNumber,
      expMin,
      expMax,
      jobBenefit,
      jobRequirement,
      industryIds,
    });

    await syncJobToAI({
      job: updatedJob,
      action: "update",
    });

    return res.status(200).json({
      success: true,
      message: "Cập nhật tin tuyển dụng thành công.",
      data: {
        job: updatedJob,
      },
    });
  } catch (error) {
    console.error("Lỗi cập nhật tin tuyển dụng:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};
const { getJobsWithPagination } = require("../models/job.model");

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const parsePositiveInteger = (value, defaultValue) => {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    return defaultValue;
  }

  return parsedValue;
};

const getJobs = async (req, res) => {
  try {
    const page = parsePositiveInteger(req.query.page, DEFAULT_PAGE);
    const requestedLimit = parsePositiveInteger(req.query.limit, DEFAULT_LIMIT);
    const limit = Math.min(requestedLimit, MAX_LIMIT);
    const offset = (page - 1) * limit;

    const { jobs, total } = await getJobsWithPagination({
      limit,
      offset,
      name: req.query.name,
      industryId: req.query.industryId,
      jobTypeId: req.query.jobTypeId,
      levelId: req.query.levelId,
      salaryMin: req.query.salaryMin,
      salaryMax: req.query.salaryMax,
      expMin: req.query.expMin,
      expMax: req.query.expMax,
    });

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách việc làm thành công.",
      data: {
        jobs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi server.",
      error: error.message,
    });
  }
};

module.exports = {
  approveApplicationRequest,
  closeMyCompanyJob,
  createJobRequest,
  extendMyCompanyJob,
  getCompanyJobsRequest,
  getJobApplicationsRequest,
  getJobDetailRequest,
  getMyCompanyJobs,
  getJobTypes,
  rejectApplicationRequest,
  reopenMyCompanyJob,
  updateExpiredJobsRequest,
  updateJob,
  getJobs,
};
