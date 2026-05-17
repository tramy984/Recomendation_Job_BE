const { createJob, getAllJobTypes } = require("../models/job.model");
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

module.exports = {
  createJobRequest,
  getJobTypes,
};
