const axios = require("axios");

const DEFAULT_AI_SERVER_URL = "https://my984-recommendation-job.hf.space/";

const getRecommendApiUrl = () => {
  const apiUrl = process.env.RECOMMEND_API_URL;

  if (apiUrl) {
    return apiUrl;
  }

  const serverUrl = (
    process.env.AI_SERVER_URL ||
    process.env.AI_RECOMMEND_SERVER_URL ||
    DEFAULT_AI_SERVER_URL
  ).replace(/\/+$/, "");

  return `${serverUrl}/recommend`;
};

const getRecommendTimeoutMs = () => {
  const configuredTimeoutMs = Number(process.env.RECOMMEND_TIMEOUT_MS);

  return Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0
    ? configuredTimeoutMs
    : 60000;
};

const normalizeString = (value) => {
  if (value === undefined || value === null) return null;

  const text = String(value).trim();
  return text || null;
};

const normalizeNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};

const normalizeInteger = (value) => {
  const number = normalizeNumber(value);

  return Number.isInteger(number) ? number : null;
};

const normalizeComparableText = (value) => {
  const text = normalizeString(value);

  if (!text) return "";

  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const VIETNAM_REGION_BY_PROVINCE = {
  "an giang": "mekong_delta",
  "ba ria vung tau": "southeast",
  "bac giang": "northern_midlands_mountains",
  "bac kan": "northern_midlands_mountains",
  "bac lieu": "mekong_delta",
  "bac ninh": "red_river_delta",
  "ben tre": "mekong_delta",
  "binh dinh": "north_central_and_central_coast",
  "binh duong": "southeast",
  "binh phuoc": "southeast",
  "binh thuan": "north_central_and_central_coast",
  "ca mau": "mekong_delta",
  "can tho": "mekong_delta",
  "cao bang": "northern_midlands_mountains",
  "da nang": "north_central_and_central_coast",
  "dak lak": "central_highlands",
  "dak nong": "central_highlands",
  "dien bien": "northern_midlands_mountains",
  "dong nai": "southeast",
  "dong thap": "mekong_delta",
  "gia lai": "central_highlands",
  "ha giang": "northern_midlands_mountains",
  "ha nam": "red_river_delta",
  "ha noi": "red_river_delta",
  "ha tinh": "north_central_and_central_coast",
  "hai duong": "red_river_delta",
  "hai phong": "red_river_delta",
  "hau giang": "mekong_delta",
  "hoa binh": "northern_midlands_mountains",
  "ho chi minh": "southeast",
  "hue": "north_central_and_central_coast",
  "hung yen": "red_river_delta",
  "khanh hoa": "north_central_and_central_coast",
  "kien giang": "mekong_delta",
  "kon tum": "central_highlands",
  "lai chau": "northern_midlands_mountains",
  "lam dong": "central_highlands",
  "lang son": "northern_midlands_mountains",
  "lao cai": "northern_midlands_mountains",
  "long an": "mekong_delta",
  "nam dinh": "red_river_delta",
  "nghe an": "north_central_and_central_coast",
  "ninh binh": "red_river_delta",
  "ninh thuan": "north_central_and_central_coast",
  "phu tho": "northern_midlands_mountains",
  "phu yen": "north_central_and_central_coast",
  "quang binh": "north_central_and_central_coast",
  "quang nam": "north_central_and_central_coast",
  "quang ngai": "north_central_and_central_coast",
  "quang ninh": "red_river_delta",
  "quang tri": "north_central_and_central_coast",
  "soc trang": "mekong_delta",
  "son la": "northern_midlands_mountains",
  "tay ninh": "southeast",
  "thai binh": "red_river_delta",
  "thai nguyen": "northern_midlands_mountains",
  "thanh hoa": "north_central_and_central_coast",
  "thua thien hue": "north_central_and_central_coast",
  "tien giang": "mekong_delta",
  "tra vinh": "mekong_delta",
  "tuyen quang": "northern_midlands_mountains",
  "vinh long": "mekong_delta",
  "vinh phuc": "red_river_delta",
  "yen bai": "northern_midlands_mountains",
};

const VIETNAM_REGION_LABELS = {
  northern_midlands_mountains: "Trung du và miền núi Bắc Bộ",
  red_river_delta: "Đồng bằng sông Hồng",
  north_central_and_central_coast:
    "Bắc Trung Bộ và Duyên hải miền Trung",
  central_highlands: "Tây Nguyên",
  southeast: "Đông Nam Bộ",
  mekong_delta: "Đồng bằng sông Cửu Long",
};

const PROVINCE_ALIASES = {
  "ba ria": "ba ria vung tau",
  brvt: "ba ria vung tau",
  "tp hcm": "ho chi minh",
  tphcm: "ho chi minh",
  "sai gon": "ho chi minh",
  "saigon": "ho chi minh",
  hcm: "ho chi minh",
  hue: "hue",
};

const EDUCATION_LEVELS = [
  {
    level: 5,
    name: "doctor",
    patterns: ["tien si", "ph d", "phd", "doctor", "doctoral"],
  },
  {
    level: 4,
    name: "master",
    patterns: ["thac si", "master", "mba"],
  },
  {
    level: 3,
    name: "bachelor",
    patterns: [
      "cu nhan",
      "dai hoc",
      "university",
      "bachelor",
      "engineer",
      "ky su",
    ],
  },
  {
    level: 2,
    name: "college",
    patterns: ["cao dang", "college"],
  },
  {
    level: 1,
    name: "intermediate",
    patterns: ["trung cap", "vocational", "so cap"],
  },
];

const getEmbeddingScore = (job) => {
  const score = normalizeNumber(job?.recommend_score ?? job?.score);

  return score ?? 0;
};

const extractProvince = (location) => {
  const text = normalizeComparableText(location);

  if (!text) return null;

  const aliasedProvince = Object.entries(PROVINCE_ALIASES).find(([alias]) =>
    text.includes(alias),
  )?.[1];

  if (aliasedProvince) return aliasedProvince;

  return (
    Object.keys(VIETNAM_REGION_BY_PROVINCE)
      .sort((left, right) => right.length - left.length)
      .find((province) => text.includes(province)) || null
  );
};

const scoreLocationMatch = ({ candidateLocation, jobLocation }) => {
  const candidateProvince = extractProvince(candidateLocation);
  const jobProvince = extractProvince(jobLocation);
  const candidateRegion = VIETNAM_REGION_BY_PROVINCE[candidateProvince];
  const jobRegion = VIETNAM_REGION_BY_PROVINCE[jobProvince];

  if (!candidateProvince || !jobProvince) {
    return {
      locationScore: 0,
      locationPriority: 0,
      locationMatchType: "unknown",
      candidateProvince,
      jobProvince,
      candidateRegion,
      jobRegion,
    };
  }

  if (candidateProvince === jobProvince) {
    return {
      locationScore: 0.3,
      locationPriority: 2,
      locationMatchType: "province",
      candidateProvince,
      jobProvince,
      candidateRegion,
      jobRegion,
    };
  }

  if (candidateRegion && candidateRegion === jobRegion) {
    return {
      locationScore: 0.15,
      locationPriority: 1,
      locationMatchType: "region",
      candidateProvince,
      jobProvince,
      candidateRegion,
      jobRegion,
    };
  }

  return {
    locationScore: 0,
    locationPriority: 0,
    locationMatchType: "none",
    candidateProvince,
    jobProvince,
    candidateRegion,
    jobRegion,
  };
};

const getExperiencePenalty = ({ candidateExperience, requiredExperience }) => {
  const candidateYears = normalizeNumber(candidateExperience);
  const requiredYears = normalizeNumber(requiredExperience);

  if (candidateYears === null || requiredYears === null) return 0;

  const gap = Math.abs(requiredYears - candidateYears);

  if (gap >= 5) return -0.5;
  if (gap >= 3) return -0.3;
  if (gap >= 2) return -0.1;
  if (gap >= 1) return -0.05;

  return 0;
};

const getEducationRankFromText = (value, { mode = "candidate" } = {}) => {
  const text = normalizeComparableText(value);

  if (!text) return null;

  if (
    mode === "job" &&
    /khong yeu cau/.test(text) &&
    /(bang cap|hoc van|trinh do)/.test(text)
  ) {
    return null;
  }

  const matchedLevels = EDUCATION_LEVELS.filter(({ patterns }) =>
    patterns.some((pattern) => text.includes(pattern)),
  ).map(({ level }) => level);

  if (matchedLevels.length === 0) return null;

  return mode === "job"
    ? Math.min(...matchedLevels)
    : Math.max(...matchedLevels);
};

const getJobRequiredEducationRank = (job) => {
  const explicitDegree =
    job?.degree ||
    job?.education ||
    job?.required_degree ||
    job?.requiredDegree ||
    job?.education_requirement ||
    job?.educationRequirement;

  const explicitRank = getEducationRankFromText(explicitDegree, {
    mode: "job",
  });

  if (explicitRank !== null) return explicitRank;

  return getEducationRankFromText(
    [job?.job_requirement, job?.description].filter(Boolean).join(" "),
    { mode: "job" },
  );
};

const getEducationPenalty = ({ candidateDegree, job }) => {
  const candidateRank = getEducationRankFromText(candidateDegree);
  const requiredRank = getJobRequiredEducationRank(job);

  if (candidateRank === null || requiredRank === null) return 0;

  const gap = Math.abs(requiredRank - candidateRank);

  if (gap >= 3) return -0.4;
  if (gap >= 2) return -0.25;
  if (gap >= 1) return -0.1;

  return 0;
};

const rerankRecommendedJobs = ({ jobs, candidate, cv }) => {
  if (!Array.isArray(jobs) || jobs.length === 0) return [];

  const candidateLocation = cv?.location || candidate?.location;
  const candidateExperience = cv?.exp_max ?? cv?.exp_min;
  const candidateDegree = cv?.degree;

  return jobs
    .map((job, index) => {
      const embeddingScore = getEmbeddingScore(job);
      const {
        locationScore,
        locationPriority,
        locationMatchType,
        candidateProvince,
        jobProvince,
        candidateRegion,
        jobRegion,
      } = scoreLocationMatch({
        candidateLocation,
        jobLocation: job?.location,
      });
      const experienceScore = getExperiencePenalty({
        candidateExperience,
        requiredExperience: job?.exp_min,
      });
      const educationScore = getEducationPenalty({
        candidateDegree,
        job,
      });
      const rerankScore =
        embeddingScore + locationScore + experienceScore + educationScore;

      return {
        ...job,
        embedding_score: embeddingScore,
        location_score: locationScore,
        location_priority: locationPriority,
        location_match_type: locationMatchType,
        candidate_province: candidateProvince,
        job_province: jobProvince,
        candidate_region: candidateRegion,
        candidate_region_name: VIETNAM_REGION_LABELS[candidateRegion] || null,
        job_region: jobRegion,
        job_region_name: VIETNAM_REGION_LABELS[jobRegion] || null,
        experience_score: experienceScore,
        education_score: educationScore,
        rerank_score: Number(rerankScore.toFixed(6)),
        original_recommend_rank: job?.recommend_rank ?? index + 1,
      };
    })
    .sort((left, right) => {
      if (right.location_priority !== left.location_priority) {
        return right.location_priority - left.location_priority;
      }

      if (right.rerank_score !== left.rerank_score) {
        return right.rerank_score - left.rerank_score;
      }

      return (
        Number(left.original_recommend_rank || 0) -
        Number(right.original_recommend_rank || 0)
      );
    });
};

const normalizeSkills = (skills) => {
  if (Array.isArray(skills)) {
    return skills.map(normalizeString).filter(Boolean);
  }

  if (typeof skills === "string") {
    return skills
      .split(",")
      .map(normalizeString)
      .filter(Boolean);
  }

  return [];
};

const normalizeRecommendation = (item) => {
  return {
    jobId: normalizeInteger(item?.job_id),
    score: normalizeNumber(item?.score),
    title: normalizeString(item?.title),
    company: normalizeString(item?.company),
    industry: normalizeString(item?.industry),
    skills: normalizeSkills(item?.skills),
  };
};

const normalizeRecommendPayload = (payload) => {
  const data = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
    ? payload
    : [];

  return data.map(normalizeRecommendation);
};

const recommendJobsByCVText = async ({ cvText }) => {
  const normalizedCVText = normalizeString(cvText);

  if (!normalizedCVText) {
    throw new Error("cvText is required to recommend jobs.");
  }

  const apiUrl = getRecommendApiUrl();

  console.log("RECOMMEND API URL:", apiUrl);

  try {
    const response = await axios.post(
      apiUrl,
      {
        cv_text: normalizedCVText,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: getRecommendTimeoutMs(),
      },
    );

    const payload = response.data;

    console.log("AI RECOMMEND RAW PAYLOAD:", JSON.stringify(payload, null, 2));

    if (payload?.success === false) {
      throw new Error(
        payload?.message ||
          payload?.error ||
          "Recommend API returned failure.",
      );
    }

    const recommendations = normalizeRecommendPayload(payload);

    console.log("AI RECOMMEND NORMALIZED:", recommendations);

    return recommendations;
  } catch (error) {
    console.log("AI RECOMMEND REQUEST ERROR:");

    if (error.response) {
      console.log("STATUS:", error.response.status);
      console.log("DATA:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.log("MESSAGE:", error.message);
    }

    throw error;
  }
};

module.exports = {
  recommendJobsByCVText,
  rerankRecommendedJobs,
};
