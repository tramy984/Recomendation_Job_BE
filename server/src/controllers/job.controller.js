const {
  createJob,
  getApplicationById,
  getAllJobTypes,
  getJobApplicationsByJobId,
  getJobById,
  getJobsByCompanyId,
  updateApplicationReviewById,
  updateExpiredJobsStatus,
  updateJobExpireById,
  updateJobStatusById,
  updateJobById
} = require("../models/job.model");
const { getRecruiterByUserId } = require("../models/recruiter.model");

const getJobPayload = (body = {}) => {
  if (body.job) return { ...body.job };

  if (!body.data) return { ...body };

  if (typeof body.data === "string") {
    try {
      const parsedData = JSON.parse(body.data);

      return parsedData.job
        ? { ...parsedData.job }
        : parsedData;
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
  const key = keys.find((fieldKey) =>
    hasOwn(data, fieldKey)
  );

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
        .map(Number)
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
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    /^\d+$/.test(value.trim())
  ) {
    return Number(value.trim());
  }

  return undefined;
};

const normalizeDecimal = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
  ) {
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
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date;
};

const getCompanyJobFilters = (query = {}) => {
  const name = normalizeText(
    readAlias(query, ["name", "keyword", "q"])
  );

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
  const industryIds = hasIndustryIds || isValidId(industryValue)
    ? normalizeIndustryIds(
        hasIndustryIds
          ? readAlias(query, industryKeys)
          : industryValue
      )
    : [];
  const industryName = hasIndustryIds || isValidId(industryValue)
    ? normalizeText(
        readAlias(query, ["industryName", "industry_name"])
      )
    : normalizeText(
        readAlias(query, [
          "industry",
          "industryName",
          "industry_name",
        ])
      );

  if (status === null || status === undefined && hasOwn(query, "status")) {
    return {
      error: "Trang thai khong hop le.",
    };
  }

  if (hasIndustryIds && industryIds.length === 0) {
    return {
      error: "Linh vuc cong viec khong hop le.",
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
    console.error(
      "Lỗi lấy danh sách hình thức làm việc:",
      error
    );

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
        message: "jobId khong hop le.",
      });
    }

    const job = await getJobById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Khong tim thay tin tuyen dung.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lay thong tin chi tiet tin tuyen dung thanh cong.",
      data: {
        job,
      },
    });
  } catch (error) {
    console.error("Loi lay thong tin chi tiet tin tuyen dung:", error);

    return res.status(500).json({
      success: false,
      message: "Loi may chu. Vui long thu lai sau.",
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
        message: "Ban chua dang nhap.",
      });
    }

    if (role !== "recruiter" && role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Ban khong co quyen xem danh sach ung vien cua tin nay.",
      });
    }

    if (!isValidId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "jobId khong hop le.",
      });
    }

    const job = await getJobById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Khong tim thay tin tuyen dung.",
      });
    }

    if (role === "recruiter") {
      const recruiter = await getRecruiterByUserId(userId);

      if (!recruiter) {
        return res.status(404).json({
          success: false,
          message: "Khong tim thay thong tin nha tuyen dung.",
        });
      }

      if (!recruiter.company_id) {
        return res.status(400).json({
          success: false,
          message: "Nha tuyen dung chua lien ket cong ty.",
        });
      }

      if (Number(job.company_id) !== Number(recruiter.company_id)) {
        return res.status(403).json({
          success: false,
          message: "Ban khong co quyen xem danh sach ung vien cua tin nay.",
        });
      }
    }

    const applications = await getJobApplicationsByJobId(job.id);

    return res.status(200).json({
      success: true,
      message: "Lay danh sach ung vien cua tin tuyen dung thanh cong.",
      data: {
        jobId: job.id,
        total: applications.length,
        applications,
      },
    });
  } catch (error) {
    console.error("Loi lay danh sach ung vien cua tin tuyen dung:", error);

    return res.status(500).json({
      success: false,
      message: "Loi may chu. Vui long thu lai sau.",
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
        message: "Ban chua dang nhap.",
      },
    };
  }

  if (role !== "recruiter" && role !== "admin") {
    return {
      statusCode: 403,
      response: {
        success: false,
        message: `Ban khong co quyen ${actionName} application nay.`,
      },
    };
  }

  if (!isValidId(applicationId)) {
    return {
      statusCode: 400,
      response: {
        success: false,
        message: "applicationId khong hop le.",
      },
    };
  }

  const application = await getApplicationById(applicationId);

  if (!application) {
    return {
      statusCode: 404,
      response: {
        success: false,
        message: "Khong tim thay application.",
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
        message: "Khong tim thay thong tin nha tuyen dung.",
      },
    };
  }

  if (!recruiter.company_id) {
    return {
      statusCode: 400,
      response: {
        success: false,
        message: "Nha tuyen dung chua lien ket cong ty.",
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
        message: `Ban khong co quyen ${actionName} application nay.`,
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
        actionName: "duyet",
      });

    if (response) {
      return res.status(statusCode).json(response);
    }

    const updatedApplication = await updateApplicationReviewById({
      applicationId: application.id,
      status: "approved",
      reasonReject: null,
    });

    return res.status(200).json({
      success: true,
      message: "Duyet application thanh cong.",
      data: {
        application: updatedApplication,
      },
    });
  } catch (error) {
    console.error("Loi duyet application:", error);

    return res.status(500).json({
      success: false,
      message: "Loi may chu. Vui long thu lai sau.",
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
        actionName: "tu choi",
      });

    if (response) {
      return res.status(statusCode).json(response);
    }

    const payload = getApplicationPayload(req.body);
    const reasonReject = normalizeText(
      readAlias(payload, [
        "reasonReject",
        "reason_reject",
        "reason",
      ])
    );

    const updatedApplication = await updateApplicationReviewById({
      applicationId: application.id,
      status: "rejected",
      reasonReject,
    });

    return res.status(200).json({
      success: true,
      message: "Tu choi application thanh cong.",
      data: {
        application: updatedApplication,
      },
    });
  } catch (error) {
    console.error("Loi tu choi application:", error);

    return res.status(500).json({
      success: false,
      message: "Loi may chu. Vui long thu lai sau.",
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
        message: "Ban chua dang nhap.",
      });
    }

    if (role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Chi nha tuyen dung moi co quyen dong tin tuyen dung.",
      });
    }

    if (!isValidId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "jobId khong hop le.",
      });
    }

    const recruiter = await getRecruiterByUserId(userId);

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Khong tim thay thong tin nha tuyen dung.",
      });
    }

    if (!recruiter.company_id) {
      return res.status(400).json({
        success: false,
        message: "Nha tuyen dung chua lien ket cong ty.",
      });
    }

    const job = await getJobById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Khong tim thay tin tuyen dung.",
      });
    }

    if (Number(job.company_id) !== Number(recruiter.company_id)) {
      return res.status(403).json({
        success: false,
        message: "Ban khong co quyen dong tin tuyen dung nay.",
      });
    }

    if (Number(job.status) === 2) {
      return res.status(400).json({
        success: false,
        message: "Tin tuyen dung da het han.",
      });
    }

    if (job.expire && new Date(job.expire).getTime() <= Date.now()) {
      const expiredJob = await updateJobStatusById(job.id, 2);

      return res.status(400).json({
        success: false,
        message: "Tin tuyen dung da het han va duoc cap nhat status = 2.",
        data: {
          job: expiredJob,
        },
      });
    }

    const closedJob = await updateJobStatusById(job.id, 0);

    return res.status(200).json({
      success: true,
      message: "Dong tin tuyen dung thanh cong.",
      data: {
        job: closedJob,
      },
    });
  } catch (error) {
    console.error("Loi dong tin tuyen dung:", error);

    return res.status(500).json({
      success: false,
      message: "Loi may chu. Vui long thu lai sau.",
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
        message: "Ban chua dang nhap.",
      });
    }

    if (role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Chi nha tuyen dung moi co quyen mo lai tin tuyen dung.",
      });
    }

    if (!isValidId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "jobId khong hop le.",
      });
    }

    const recruiter = await getRecruiterByUserId(userId);

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Khong tim thay thong tin nha tuyen dung.",
      });
    }

    if (!recruiter.company_id) {
      return res.status(400).json({
        success: false,
        message: "Nha tuyen dung chua lien ket cong ty.",
      });
    }

    const job = await getJobById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Khong tim thay tin tuyen dung.",
      });
    }

    if (Number(job.company_id) !== Number(recruiter.company_id)) {
      return res.status(403).json({
        success: false,
        message: "Ban khong co quyen mo lai tin tuyen dung nay.",
      });
    }

    if (Number(job.status) === 2) {
      return res.status(400).json({
        success: false,
        message: "Tin tuyen dung da het han.",
      });
    }

    if (job.expire && new Date(job.expire).getTime() <= Date.now()) {
      const expiredJob = await updateJobStatusById(job.id, 2);

      return res.status(400).json({
        success: false,
        message: "Tin tuyen dung da het han va duoc cap nhat status = 2.",
        data: {
          job: expiredJob,
        },
      });
    }

    if (Number(job.status) !== 0) {
      return res.status(400).json({
        success: false,
        message: "Chi co the mo lai tin tuyen dung dang dong.",
      });
    }

    const reopenedJob = await updateJobStatusById(job.id, 1);

    return res.status(200).json({
      success: true,
      message: "Mo lai tin tuyen dung thanh cong.",
      data: {
        job: reopenedJob,
      },
    });
  } catch (error) {
    console.error("Loi mo lai tin tuyen dung:", error);

    return res.status(500).json({
      success: false,
      message: "Loi may chu. Vui long thu lai sau.",
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
        message: "Ban chua dang nhap.",
      });
    }

    if (role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message: "Chi nha tuyen dung moi co quyen gia han tin tuyen dung.",
      });
    }

    if (!isValidId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "jobId khong hop le.",
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
      ])
    );

    if (expire === null || expire === undefined) {
      return res.status(400).json({
        success: false,
        message: "Ngay het han moi khong hop le.",
      });
    }

    if (expire.getTime() <= Date.now()) {
      return res.status(400).json({
        success: false,
        message: "Ngay het han moi phai lon hon thoi diem hien tai.",
      });
    }

    const recruiter = await getRecruiterByUserId(userId);

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Khong tim thay thong tin nha tuyen dung.",
      });
    }

    if (!recruiter.company_id) {
      return res.status(400).json({
        success: false,
        message: "Nha tuyen dung chua lien ket cong ty.",
      });
    }

    const job = await getJobById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Khong tim thay tin tuyen dung.",
      });
    }

    if (Number(job.company_id) !== Number(recruiter.company_id)) {
      return res.status(403).json({
        success: false,
        message: "Ban khong co quyen gia han tin tuyen dung nay.",
      });
    }

    const currentStatus =
      job.status === null || job.status === undefined
        ? undefined
        : Number(job.status);
    const nextStatus = currentStatus === 0 ? 0 : 1;
    const extendedJob = await updateJobExpireById(
      job.id,
      expire,
      nextStatus
    );

    return res.status(200).json({
      success: true,
      message: "Gia han tin tuyen dung thanh cong.",
      data: {
        job: extendedJob,
      },
    });
  } catch (error) {
    console.error("Loi gia han tin tuyen dung:", error);

    return res.status(500).json({
      success: false,
      message: "Loi may chu. Vui long thu lai sau.",
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
        message: "Chi admin moi co quyen cap nhat tin tuyen dung het han.",
      });
    }

    const expiredJobs = await updateExpiredJobsStatus();

    return res.status(200).json({
      success: true,
      message: "Cap nhat tin tuyen dung het han thanh cong.",
      data: {
        updatedCount: expiredJobs.length,
        jobIds: expiredJobs.map((job) => job.id),
      },
    });
  } catch (error) {
    console.error("Loi cap nhat tin tuyen dung het han:", error);

    return res.status(500).json({
      success: false,
      message: "Loi may chu. Vui long thu lai sau.",
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
        message: "Ban chua dang nhap.",
      });
    }

    if (role !== "recruiter") {
      return res.status(403).json({
        success: false,
        message:
          "Chi nha tuyen dung moi co quyen xem tin tuyen dung cua cong ty.",
      });
    }

    const recruiter = await getRecruiterByUserId(userId);

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Khong tim thay thong tin nha tuyen dung.",
      });
    }

    if (!recruiter.company_id) {
      return res.status(400).json({
        success: false,
        message: "Nha tuyen dung chua lien ket cong ty.",
      });
    }

    const { filters, error } = getCompanyJobFilters(req.query);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    const jobs = await getJobsByCompanyId(
      recruiter.company_id,
      filters
    );

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
      message: "Loi may chu. Vui long thu lai sau.",
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
        message:
          "Chỉ nhà tuyển dụng mới có quyền tạo tin tuyển dụng.",
      });
    }

    const recruiter = await getRecruiterByUserId(userId);

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy thông tin nhà tuyển dụng.",
      });
    }

    if (!recruiter.company_id) {
      return res.status(400).json({
        success: false,
        message:
          "Nhà tuyển dụng chưa liên kết công ty.",
      });
    }

    const payload = getJobPayload(req.body);

    const name = normalizeText(payload.name);

    if (!name) {
      return res.status(400).json({
        success: false,
        message:
          "Tên tin tuyển dụng không được để trống.",
      });
    }

    const salaryMin = normalizeDecimal(
      readAlias(payload, ["salaryMin", "salary_min"])
    );

    const salaryMax = normalizeDecimal(
      readAlias(payload, ["salaryMax", "salary_max"])
    );

    const normalizedStatus = normalizeBigInt(
      payload.status
    );

    const status =
      normalizedStatus === null
        ? 1
        : normalizedStatus;

    const levelId = normalizeBigInt(
      readAlias(payload, [
        "levelId",
        "idLevel",
        "id_level",
      ])
    );

    const jobTypeId = normalizeBigInt(
      readAlias(payload, [
        "jobTypeId",
        "job_type_id",
      ])
    );

    const candidateNumber = normalizeBigInt(
      readAlias(payload, [
        "candidateNumber",
        "candidate_number",
      ])
    );

    const expMin = normalizeDecimal(
      readAlias(payload, ["expMin", "exp_min"])
    );

    const expMax = normalizeDecimal(
      readAlias(payload, ["expMax", "exp_max"])
    );

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
        message:
          "Ngày hết hạn tuyển dụng không hợp lệ.",
      });
    }

    if (
      salaryMin !== null &&
      salaryMax !== null &&
      Number(salaryMin) > Number(salaryMax)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Mức lương tối thiểu không được lớn hơn mức lương tối đa.",
      });
    }

    if (
      expMin !== null &&
      expMax !== null &&
      Number(expMin) > Number(expMax)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Kinh nghiệm tối thiểu không được lớn hơn kinh nghiệm tối đa.",
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
        readAlias(payload, [
          "jobBenefit",
          "job_benefit",
        ])
      ),

      jobRequirement: normalizeText(
        readAlias(payload, [
          "jobRequirement",
          "job_requirement",
        ])
      ),
    });

    return res.status(201).json({
      success: true,
      message:
        "Tạo tin tuyển dụng thành công.",
      data: {
        job,
      },
    });
  } catch (error) {
    console.error(
      "Lỗi tạo tin tuyển dụng:",
      error
    );

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message:
          "Dữ liệu liên kết không hợp lệ.",
        error: error.detail || error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Lỗi máy chủ. Vui lòng thử lại sau.",
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

module.exports = {
  approveApplicationRequest,
  closeMyCompanyJob,
  createJobRequest,
  extendMyCompanyJob,
  getJobApplicationsRequest,
  getJobDetailRequest,
  getMyCompanyJobs,
  getJobTypes,
  rejectApplicationRequest,
  reopenMyCompanyJob,
  updateExpiredJobsRequest,
  updateJob,
};
