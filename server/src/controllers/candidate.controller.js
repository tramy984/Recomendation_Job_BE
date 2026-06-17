const {
  findCandidateById,
  findCandidateByUserId,
  updateCandidateByUserId,
} = require("../models/candidate.model");
const { findDefaultCVByCandidateId } = require("../models/cv.model");
const {
  findAllRecommendableJobs,
  findRecommendedJobsByIdsAndIndustry,
  findRecommendedJobsByIdsWithIndustryPriority,
} = require("../models/job.model");
const {
  applyJobForCandidate,
  findApplicationsByCandidateId,
} = require("../models/application.model");
const {
  findSavedJobsByCandidateId,
  saveJobForCandidate,
  unsaveJobForCandidate,
} = require("../models/saved_job.model");
const {
  notifyJobApplicationCountIfNeeded,
} = require("../services/notification.service");
const {
  deleteFileFromStorage,
  uploadFileToStorage,
} = require("../services/storage.service");
const {
  recommendFullPosNegJobsByCVText,
  recommendJobsByCVText,
  rerankRecommendedJobs,
} = require("../services/recommend.service");

const removeLocalUploadedFile = async (file) => {
  if (!file?.path) return;

  try {
    const fs = require("fs");
    await fs.promises.unlink(file.path);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("DELETE LOCAL UPLOAD ERROR:", error);
    }
  }
};

const isValidId = (value) => {
  return /^\d+$/.test(String(value || ""));
};

const DEFAULT_RECOMMEND_PAGE = 1;
const DEFAULT_RECOMMEND_LIMIT = 10;
const MAX_RECOMMEND_LIMIT = 100;

const parsePositiveInteger = (value, defaultValue) => {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    return defaultValue;
  }

  return parsedValue;
};

const normalizeFilterText = (value) => {
  if (value === undefined || value === null) return "";

  return String(value)
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();
};

const normalizeNumberFilter = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};

const normalizeSalaryFilterToVnd = (value) => {
  const number = normalizeNumberFilter(value);

  if (number === null) return null;

  return Math.abs(number) >= 1000000 ? number : number * 1000000;
};

const readQueryAlias = (query, keys) => {
  const key = keys.find((item) => query[item] !== undefined);

  return key ? query[key] : undefined;
};

const isAllFilterValue = (value) => {
  return ["all", "tat ca", "tat_ca", "tatca"].includes(
    normalizeFilterText(value),
  );
};

const getRecommendedJobIndustryIds = (job) => {
  const industryIds = [];

  if (Array.isArray(job?.industries)) {
    job.industries.forEach((industry) => {
      const industryId =
        typeof industry === "object" ? industry?.id : industry;

      if (isValidId(industryId)) {
        industryIds.push(Number(industryId));
      }
    });
  }

  const directIndustryId =
    job?.industry_id ?? job?.industryId ?? job?.industry?.id;

  if (isValidId(directIndustryId)) {
    industryIds.push(Number(directIndustryId));
  }

  return [...new Set(industryIds)];
};

const getRecommendedJobIndustryText = (job) => {
  const industryNames = Array.isArray(job?.industries)
    ? job.industries
        .map((industry) =>
          typeof industry === "object" ? industry?.name : industry,
        )
        .filter(Boolean)
    : [];

  return normalizeFilterText(
    [
      ...industryNames,
      job?.industry?.name,
      job?.industry,
      job?.industry_name,
      job?.industryName,
    ]
      .filter(Boolean)
      .join(" "),
  );
};

const getRecommendedJobTypeId = (job) => {
  const jobTypeId = job?.job_type_id ?? job?.jobTypeId ?? job?.job_type?.id;

  return isValidId(jobTypeId) ? Number(jobTypeId) : null;
};

const getRecommendedJobTypeText = (job) => {
  return normalizeFilterText(
    [job?.job_type?.name, job?.jobType?.name, job?.job_type_name]
      .filter(Boolean)
      .join(" "),
  );
};

const getRecommendedJobExperienceRange = (job) => {
  const expMin = normalizeNumberFilter(job?.exp_min ?? job?.expMin) ?? 0;
  const expMax =
    normalizeNumberFilter(job?.exp_max ?? job?.expMax) ?? expMin;

  return {
    expMin,
    expMax,
  };
};

const getRecommendedJobSalaryRange = (job) => {
  const salaryMin = normalizeNumberFilter(job?.salary_min ?? job?.salaryMin);
  const salaryMax = normalizeNumberFilter(job?.salary_max ?? job?.salaryMax);

  return {
    salaryMin,
    salaryMax,
  };
};

const matchesSalaryRange = ({ job, salaryMin, salaryMax }) => {
  const jobSalary = getRecommendedJobSalaryRange(job);

  if (jobSalary.salaryMin === null && jobSalary.salaryMax === null) {
    return false;
  }

  const jobMin = jobSalary.salaryMin ?? jobSalary.salaryMax;
  const jobMax = jobSalary.salaryMax ?? jobSalary.salaryMin;

  if (salaryMin !== null && jobMin < salaryMin) return false;
  if (salaryMax !== null && jobMax > salaryMax) return false;

  return true;
};

const matchesSalaryFilter = (job, salaryFilter) => {
  const normalizedFilter = normalizeFilterText(salaryFilter)
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
  const salaryNumbers = normalizedFilter
    .match(/\d+(?:\.\d+)?/g)
    ?.map(Number)
    .filter(Number.isFinite);

  if (!normalizedFilter || isAllFilterValue(salaryFilter)) return true;

  if (salaryNumbers?.length >= 2) {
    return matchesSalaryRange({
      job,
      salaryMin:
        Math.min(salaryNumbers[0], salaryNumbers[1]) * 1000000,
      salaryMax:
        Math.max(salaryNumbers[0], salaryNumbers[1]) * 1000000,
    });
  }

  if (
    [
      "under_10",
      "duoi_10",
      "duoi_10_trieu",
      "less_than_10",
      "lt_10",
    ].includes(normalizedFilter)
  ) {
    return matchesSalaryRange({ job, salaryMin: null, salaryMax: 10000000 });
  }

  if (["10_15", "from_10_to_15"].includes(normalizedFilter)) {
    return matchesSalaryRange({
      job,
      salaryMin: 10000000,
      salaryMax: 15000000,
    });
  }

  if (["15_20", "from_15_to_20"].includes(normalizedFilter)) {
    return matchesSalaryRange({
      job,
      salaryMin: 15000000,
      salaryMax: 20000000,
    });
  }

  if (["20_30", "from_20_to_30"].includes(normalizedFilter)) {
    return matchesSalaryRange({
      job,
      salaryMin: 20000000,
      salaryMax: 30000000,
    });
  }

  if (
    [
      "over_30",
      "tren_30",
      "tren_30_trieu",
      "greater_than_30",
      "gt_30",
    ].includes(normalizedFilter)
  ) {
    return matchesSalaryRange({ job, salaryMin: 30000000, salaryMax: null });
  }

  return true;
};

const getRecommendedJobLevelId = (job) => {
  const levelId = job?.id_level ?? job?.level_id ?? job?.levelId ?? job?.level?.id;

  return isValidId(levelId) ? Number(levelId) : null;
};

const getRecommendedJobLevelText = (job) => {
  return normalizeFilterText(
    [job?.level?.name, job?.level_name, job?.levelName]
      .filter(Boolean)
      .join(" "),
  );
};

const matchesExperienceRange = ({ job, expMin, expMax }) => {
  const jobExperience = getRecommendedJobExperienceRange(job);

  if (expMin !== null && jobExperience.expMax < expMin) return false;
  if (expMax !== null && jobExperience.expMin > expMax) return false;

  return true;
};

const matchesExperienceFilter = (job, experienceFilter) => {
  const normalizedFilter = normalizeFilterText(experienceFilter).replace(
    /\s+/g,
    "_",
  );
  const { expMin, expMax } = getRecommendedJobExperienceRange(job);

  if (!normalizedFilter || normalizedFilter === "all") return true;

  if (
    [
      "none",
      "no",
      "no_required",
      "no_require",
      "khong_yeu_cau",
      "khongyeucau",
      "0",
    ].includes(normalizedFilter)
  ) {
    return expMin <= 0 && expMax <= 0;
  }

  if (
    [
      "under_1",
      "duoi_1",
      "duoi_1_nam",
      "less_than_1",
      "lt_1",
    ].includes(normalizedFilter)
  ) {
    return expMax > 0 && matchesExperienceRange({ job, expMin: 0, expMax: 1 });
  }

  if (["1_3", "1-3", "from_1_to_3"].includes(normalizedFilter)) {
    return matchesExperienceRange({ job, expMin: 1, expMax: 3 });
  }

  if (["3_5", "3-5", "from_3_to_5"].includes(normalizedFilter)) {
    return matchesExperienceRange({ job, expMin: 3, expMax: 5 });
  }

  if (
    [
      "over_5",
      "tren_5",
      "tren_5_nam",
      "greater_than_5",
      "gt_5",
    ].includes(normalizedFilter)
  ) {
    return expMax > 5;
  }

  return true;
};

const getRecommendedJobFilters = (query = {}) => {
  const page = parsePositiveInteger(
    readQueryAlias(query, ["page"]),
    DEFAULT_RECOMMEND_PAGE,
  );
  const requestedLimit = parsePositiveInteger(
    readQueryAlias(query, ["limit", "pageSize", "page_size"]),
    DEFAULT_RECOMMEND_LIMIT,
  );
  const limit = Math.min(requestedLimit, MAX_RECOMMEND_LIMIT);
  const keyword = normalizeFilterText(
    readQueryAlias(query, ["keyword", "q", "search", "name"]),
  );
  const industry = readQueryAlias(query, [
    "industryId",
    "industry_id",
    "categoryId",
    "category_id",
    "category",
    "industry",
  ]);
  const jobType = readQueryAlias(query, [
    "jobTypeId",
    "job_type_id",
    "jobType",
    "job_type",
    "workType",
    "work_type",
  ]);
  const level = readQueryAlias(query, [
    "levelId",
    "level_id",
    "level",
    "rank",
    "positionLevel",
    "position_level",
  ]);

  const industryText = isAllFilterValue(industry)
    ? ""
    : normalizeFilterText(industry);
  const jobTypeText = isAllFilterValue(jobType)
    ? ""
    : normalizeFilterText(jobType);
  const levelText = isAllFilterValue(level) ? "" : normalizeFilterText(level);

  return {
    page,
    limit,
    keyword,
    industryId:
      !isAllFilterValue(industry) && isValidId(industry)
        ? Number(industry)
        : null,
    industryText: isValidId(industry) ? "" : industryText,
    jobTypeId:
      !isAllFilterValue(jobType) && isValidId(jobType)
        ? Number(jobType)
        : null,
    jobTypeText: isValidId(jobType) ? "" : jobTypeText,
    levelId:
      !isAllFilterValue(level) && isValidId(level) ? Number(level) : null,
    levelText: isValidId(level) ? "" : levelText,
    experience: readQueryAlias(query, [
      "experience",
      "experienceFilter",
      "exp",
      "expFilter",
    ]),
    expMin: normalizeNumberFilter(readQueryAlias(query, ["expMin", "exp_min"])),
    expMax: normalizeNumberFilter(readQueryAlias(query, ["expMax", "exp_max"])),
    salary: readQueryAlias(query, [
      "salary",
      "salaryRange",
      "salary_range",
      "salaryFilter",
      "salary_filter",
      "wage",
    ]),
    salaryMin: normalizeSalaryFilterToVnd(
      readQueryAlias(query, ["salaryMin", "salary_min"]),
    ),
    salaryMax: normalizeSalaryFilterToVnd(
      readQueryAlias(query, ["salaryMax", "salary_max"]),
    ),
  };
};

const filterRecommendedJobs = (jobs, filters) => {
  return jobs.filter((job) => {
    if (filters.keyword) {
      const searchableText = normalizeFilterText(
        [
          job?.name,
          job?.title,
          job?.location,
          job?.company?.name,
          job?.company_name,
          job?.companyName,
        ]
          .filter(Boolean)
          .join(" "),
      );

      if (!searchableText.includes(filters.keyword)) return false;
    }

    if (filters.industryId !== null) {
      const industryIds = getRecommendedJobIndustryIds(job);

      if (!industryIds.includes(filters.industryId)) return false;
    }

    if (filters.industryText) {
      const industryText = getRecommendedJobIndustryText(job);

      if (!industryText.includes(filters.industryText)) return false;
    }

    if (filters.jobTypeId !== null) {
      const jobTypeId = getRecommendedJobTypeId(job);

      if (jobTypeId !== filters.jobTypeId) return false;
    }

    if (filters.jobTypeText) {
      const jobTypeText = getRecommendedJobTypeText(job);

      if (!jobTypeText.includes(filters.jobTypeText)) return false;
    }

    if (filters.levelId !== null) {
      const levelId = getRecommendedJobLevelId(job);

      if (levelId !== filters.levelId) return false;
    }

    if (filters.levelText) {
      const levelText = getRecommendedJobLevelText(job);

      if (!levelText.includes(filters.levelText)) return false;
    }

    if (!matchesExperienceFilter(job, filters.experience)) return false;

    if (
      filters.expMin !== null &&
      !matchesExperienceRange({ job, expMin: filters.expMin, expMax: null })
    ) {
      return false;
    }

    if (
      filters.expMax !== null &&
      !matchesExperienceRange({ job, expMin: null, expMax: filters.expMax })
    ) {
      return false;
    }

    if (!matchesSalaryFilter(job, filters.salary)) return false;

    if (
      filters.salaryMin !== null &&
      !matchesSalaryRange({
        job,
        salaryMin: filters.salaryMin,
        salaryMax: null,
      })
    ) {
      return false;
    }

    if (
      filters.salaryMax !== null &&
      !matchesSalaryRange({
        job,
        salaryMin: null,
        salaryMax: filters.salaryMax,
      })
    ) {
      return false;
    }

    return true;
  });
};

const paginateRecommendedJobs = ({ jobs, page, limit }) => {
  const total = jobs.length;
  const totalPages = Math.ceil(total / limit);
  const safePage = totalPages > 0 ? Math.min(page, totalPages) : page;
  const offset = (safePage - 1) * limit;

  return {
    pageJobs: jobs.slice(offset, offset + limit),
    pagination: {
      page: safePage,
      limit,
      total,
      totalPages,
    },
  };
};

const buildRecommendedJobInputs = (recommendedJobs) => {
  const seenJobIds = new Set();
  const jobIds = [];
  const scores = [];

  recommendedJobs.forEach((job) => {
    const jobId = job?.jobId;

    if (!isValidId(jobId) || seenJobIds.has(Number(jobId))) {
      return;
    }

    seenJobIds.add(Number(jobId));
    jobIds.push(Number(jobId));
    scores.push(Number.isFinite(Number(job.score)) ? Number(job.score) : null);
  });

  return {
    jobIds,
    scores,
  };
};

const getRerankedRecommendedJobs = async ({
  recommendedJobs,
  industryId,
  candidate,
  cv,
}) => {
  const { jobIds, scores } = buildRecommendedJobInputs(recommendedJobs);
  const jobs = await findRecommendedJobsByIdsWithIndustryPriority({
    jobIds,
    scores,
    industryId,
  });

  return rerankRecommendedJobs({
    jobs,
    candidate,
    cv,
  });
};

const getMyCandidate = async (req, res) => {
  try {
    const userId = req.user.id;

    const candidate = await findCandidateByUserId(userId);

    if (!candidate) {
      if (avatar) {
        await deleteFileFromStorage(avatar);
      }

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
      message: "Lỗi server.",
    });
  }
};

const getCandidateDetail = async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Chỉ admin mới có quyền xem hồ sơ ứng viên.",
      });
    }

    const { candidateId } = req.params;

    if (!isValidId(candidateId)) {
      return res.status(400).json({
        success: false,
        message: "candidateId không hợp lệ.",
      });
    }

    const candidate = await findCandidateById(candidateId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    return res.status(200).json({
      candidate,
    });
  } catch (error) {
    console.log("GET CANDIDATE DETAIL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server.",
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
      avatar = await uploadFileToStorage({
        file: req.file,
        folder: `candidate-avatars/${userId}`,
      });

      await removeLocalUploadedFile(req.file);

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
    if (req.file) {
      await removeLocalUploadedFile(req.file);
    }

    console.log("UPDATE MY CANDIDATE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Cập nhật thông tin thất bại.",
    });
  }
};

const getMySavedJobs = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập.",
      });
    }

    if (role !== "candidate") {
      return res.status(403).json({
        success: false,
        message: "Chỉ ứng viên mới có quyền xem việc làm đã lưu.",
      });
    }

    const candidate = await findCandidateByUserId(userId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    const jobs = await findSavedJobsByCandidateId(candidate.id);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách việc làm đã lưu thành công.",
      data: {
        candidateId: candidate.id,
        total: jobs.length,
        jobs,
      },
    });
  } catch (error) {
    console.log("GET MY SAVED JOBS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server.",
      error: error.message,
    });
  }
};

const getMyRecommendedJobs = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập.",
      });
    }

    if (role !== "candidate") {
      return res.status(403).json({
        success: false,
        message: "Chỉ ứng viên mới có quyền xem việc làm gợi ý.",
      });
    }

    const candidate = await findCandidateByUserId(userId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    const defaultCV = await findDefaultCVByCandidateId(candidate.id);

    if (!defaultCV) {
      return res.status(404).json({
        success: false,
        message: "Bạn chưa có CV mặc định.",
      });
    }

    if (!defaultCV.cv_text) {
      return res.status(400).json({
        success: false,
        message: "CV mặc định chưa có nội dung để gợi ý việc làm.",
      });
    }

    if (!defaultCV.id_industry) {
      return res.status(400).json({
        success: false,
        message: "CV mặc định chưa có ngành nghề để lọc việc làm phù hợp.",
      });
    }

    const recommendedJobs = await recommendJobsByCVText({
      cvText: defaultCV.cv_text,
    });
    console.log(
      `Recommended ${recommendedJobs.length} jobs for candidate ${candidate.id} with CV ${defaultCV.id}`,
    );
    const { jobIds, scores } = buildRecommendedJobInputs(recommendedJobs);

    const jobs = await findRecommendedJobsByIdsAndIndustry({
      jobIds,
      scores,
      industryId: defaultCV.id_industry,
    });
    const rerankedJobs = rerankRecommendedJobs({
      jobs,
      candidate,
      cv: defaultCV,
    });

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách việc làm gợi ý thành công.",
      data: {
        candidateId: candidate.id,
        cv: {
          id: defaultCV.id,
          industryId: defaultCV.id_industry,
          industry: defaultCV.industry,
        },
        totalRecommended: recommendedJobs.length,
        total: rerankedJobs.length,
        jobs: rerankedJobs,
      },
    });
  } catch (error) {
    console.log("GET MY RECOMMENDED JOBS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server.",
      error: error.message,
    });
  }
};

const getMyRecommendedJobsFullPosNeg = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập.",
      });
    }

    if (role !== "candidate") {
      return res.status(403).json({
        success: false,
        message: "Chỉ ứng viên mới có quyền xem việc làm gợi ý.",
      });
    }

    const candidate = await findCandidateByUserId(userId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    const defaultCV = await findDefaultCVByCandidateId(candidate.id);

    if (!defaultCV) {
      const allJobs = await findAllRecommendableJobs();
      const filters = getRecommendedJobFilters(req.query);
      const filteredJobs = filterRecommendedJobs(allJobs, filters);
      const { pageJobs, pagination } = paginateRecommendedJobs({
        jobs: filteredJobs,
        page: filters.page,
        limit: filters.limit,
      });

      return res.status(200).json({
        success: true,
        message: "Lấy danh sách việc làm thành công.",
        data: {
          candidateId: candidate.id,
          cv: null,
          threshold: null,
          totalRecommended: allJobs.length,
          totalBeforeFilter: allJobs.length,
          totalPositiveBeforeFilter: 0,
          totalNegativeBeforeFilter: 0,
          totalPositive: 0,
          totalNegative: 0,
          total: filteredJobs.length,
          filters: {
            keyword: filters.keyword || null,
            industryId: filters.industryId,
            industry: filters.industryText || null,
            jobTypeId: filters.jobTypeId,
            jobType: filters.jobTypeText || null,
            levelId: filters.levelId,
            level: filters.levelText || null,
            experience: filters.experience || null,
            expMin: filters.expMin,
            expMax: filters.expMax,
            salary: filters.salary || null,
            salaryMin: filters.salaryMin,
            salaryMax: filters.salaryMax,
          },
          pagination,
          jobs: pageJobs,
          pos: [],
          neg: [],
          allJobs: pageJobs,
        },
      });
    }

    if (!defaultCV.cv_text) {
      return res.status(400).json({
        success: false,
        message: "CV mặc định chưa có nội dung để gợi ý việc làm.",
      });
    }

    const recommendationResult = await recommendFullPosNegJobsByCVText({
      cvText: defaultCV.cv_text,
      threshold: req.query?.threshold,
    });

    console.log(
      `Recommended ${recommendationResult.total} full pos neg jobs for candidate ${candidate.id} with CV ${defaultCV.id}`,
    );

    const recommendedJobs = [
      ...recommendationResult.pos,
      ...recommendationResult.neg,
    ];
    const allJobs = await getRerankedRecommendedJobs({
      recommendedJobs,
      industryId: defaultCV.id_industry,
      candidate,
      cv: defaultCV,
    });
    const positiveJobIds = new Set(
      recommendationResult.pos
        .map((job) => Number(job?.jobId))
        .filter((jobId) => isValidId(jobId)),
    );
    const negativeJobIds = new Set(
      recommendationResult.neg
        .map((job) => Number(job?.jobId))
        .filter((jobId) => isValidId(jobId)),
    );
    const rerankedPosJobs = allJobs.filter((job) =>
      positiveJobIds.has(Number(job?.id)),
    );
    const rerankedNegJobs = allJobs.filter((job) =>
      negativeJobIds.has(Number(job?.id)),
    );
    const filters = getRecommendedJobFilters(req.query);
    const filteredJobs = filterRecommendedJobs(allJobs, filters);
    const filteredPosJobs = filteredJobs.filter((job) =>
      positiveJobIds.has(Number(job?.id)),
    );
    const filteredNegJobs = filteredJobs.filter((job) =>
      negativeJobIds.has(Number(job?.id)),
    );
    const { pageJobs, pagination } = paginateRecommendedJobs({
      jobs: filteredJobs,
      page: filters.page,
      limit: filters.limit,
    });
    const pagePosJobs = pageJobs.filter((job) =>
      positiveJobIds.has(Number(job?.id)),
    );
    const pageNegJobs = pageJobs.filter((job) =>
      negativeJobIds.has(Number(job?.id)),
    );

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách việc làm gợi ý pos/neg thành công.",
      data: {
        candidateId: candidate.id,
        cv: {
          id: defaultCV.id,
          industryId: defaultCV.id_industry,
          industry: defaultCV.industry,
        },
        threshold: recommendationResult.threshold,
        totalRecommended: recommendationResult.total,
        totalBeforeFilter: allJobs.length,
        totalPositiveBeforeFilter: rerankedPosJobs.length,
        totalNegativeBeforeFilter: rerankedNegJobs.length,
        totalPositive: filteredPosJobs.length,
        totalNegative: filteredNegJobs.length,
        total: filteredJobs.length,
        filters: {
          keyword: filters.keyword || null,
          industryId: filters.industryId,
          industry: filters.industryText || null,
          jobTypeId: filters.jobTypeId,
          jobType: filters.jobTypeText || null,
          levelId: filters.levelId,
          level: filters.levelText || null,
          experience: filters.experience || null,
          expMin: filters.expMin,
          expMax: filters.expMax,
          salary: filters.salary || null,
          salaryMin: filters.salaryMin,
          salaryMax: filters.salaryMax,
        },
        pagination,
        jobs: pageJobs,
        pos: pagePosJobs,
        neg: pageNegJobs,
        allJobs: pageJobs,
      },
    });
  } catch (error) {
    console.log("GET MY RECOMMENDED JOBS FULL POS NEG ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server.",
      error: error.message,
    });
  }
};

const saveMyJob = async (req, res) => {
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

    if (role !== "candidate") {
      return res.status(403).json({
        success: false,
        message: "Chỉ ứng viên mới có quyền lưu việc làm.",
      });
    }

    if (!isValidId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "jobId không hợp lệ.",
      });
    }

    const candidate = await findCandidateByUserId(userId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    const savedJob = await saveJobForCandidate({
      candidateId: candidate.id,
      jobId,
    });

    if (!savedJob) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy việc làm.",
      });
    }

    return res.status(savedJob.created ? 201 : 200).json({
      success: true,
      message: savedJob.created
        ? "Lưu việc làm thành công."
        : "Việc làm này đã được lưu trước đó.",
      data: {
        savedJob,
      },
    });
  } catch (error) {
    console.log("SAVE MY JOB ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server.",
      error: error.message,
    });
  }
};

const unsaveMyJob = async (req, res) => {
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

    if (role !== "candidate") {
      return res.status(403).json({
        success: false,
        message: "Chỉ ứng viên mới có quyền bỏ lưu việc làm.",
      });
    }

    if (!isValidId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "jobId không hợp lệ.",
      });
    }

    const candidate = await findCandidateByUserId(userId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    const unsavedJob = await unsaveJobForCandidate({
      candidateId: candidate.id,
      jobId,
    });

    if (!unsavedJob) {
      return res.status(404).json({
        success: false,
        message: "Việc làm này chưa được lưu.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Bỏ lưu việc làm thành công.",
      data: {
        unsavedJob,
      },
    });
  } catch (error) {
    console.log("UNSAVE MY JOB ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server.",
      error: error.message,
    });
  }
};

const applyMyJob = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const { jobId } = req.params;
    const { cvId } = req.body || {};

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập.",
      });
    }

    if (role !== "candidate") {
      return res.status(403).json({
        success: false,
        message: "Chỉ ứng viên mới có quyền ứng tuyển việc làm.",
      });
    }

    if (!isValidId(jobId)) {
      return res.status(400).json({
        success: false,
        message: "jobId không hợp lệ.",
      });
    }

    if (
      cvId !== undefined &&
      cvId !== null &&
      cvId !== "" &&
      !isValidId(cvId)
    ) {
      return res.status(400).json({
        success: false,
        message: "cvId không hợp lệ.",
      });
    }

    const candidate = await findCandidateByUserId(userId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    const result = await applyJobForCandidate({
      candidateId: candidate.id,
      jobId,
      cvId: cvId || null,
    });

    if (!result || result.error === "job_not_found") {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy việc làm.",
      });
    }

    if (result.error === "job_not_open") {
      return res.status(400).json({
        success: false,
        message: "Tin tuyển dụng không còn mở ứng tuyển.",
      });
    }

    if (result.error === "cv_not_found") {
      return res.status(400).json({
        success: false,
        message: cvId
          ? "Không tìm thấy CV của bạn."
          : "Bạn cần tải lên CV trước khi ứng tuyển.",
      });
    }

    if (result.created) {
      await notifyJobApplicationCountIfNeeded({ jobId });
    }

    return res.status(result.created ? 201 : 200).json({
      success: true,
      message: result.created
        ? "Ứng tuyển việc làm thành công."
        : "Bạn đã ứng tuyển việc làm này trước đó.",
      data: {
        application: result.application,
      },
    });
  } catch (error) {
    console.log("APPLY MY JOB ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server.",
      error: error.message,
    });
  }
};

const getMyApplications = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập.",
      });
    }

    if (role !== "candidate") {
      return res.status(403).json({
        success: false,
        message: "Chỉ ứng viên mới có quyền xem việc làm đã ứng tuyển.",
      });
    }

    const candidate = await findCandidateByUserId(userId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy candidate.",
      });
    }

    const applications = await findApplicationsByCandidateId(candidate.id);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách việc làm đã ứng tuyển thành công.",
      data: {
        candidateId: candidate.id,
        total: applications.length,
        applications,
      },
    });
  } catch (error) {
    console.log("GET MY APPLICATIONS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server.",
      error: error.message,
    });
  }
};

module.exports = {
  applyMyJob,
  getCandidateDetail,
  getMyApplications,
  getMyCandidate,
  getMyRecommendedJobsFullPosNeg,
  getMyRecommendedJobs,
  getMySavedJobs,
  saveMyJob,
  unsaveMyJob,
  updateMyCandidate,
};
