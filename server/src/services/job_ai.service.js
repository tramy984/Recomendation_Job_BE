const axios = require("axios");

const DEFAULT_AI_SERVER_URL = "https://my984-recommendation-job.hf.space/";

const getJobIndexApiUrl = () => {
  const apiUrl = process.env.JOB_INDEX_API_URL;

  if (apiUrl) {
    return apiUrl;
  }

  const serverUrl = (
    process.env.AI_SERVER_URL ||
    process.env.AI_JOB_INDEX_SERVER_URL ||
    DEFAULT_AI_SERVER_URL
  ).replace(/\/+$/, "");

  return `${serverUrl}/jobs/upsert`;
};

const getJobIndexTimeoutMs = () => {
  const configuredTimeoutMs = Number(process.env.JOB_INDEX_TIMEOUT_MS);

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

const normalizeIndustries = (industries) => {
  if (!Array.isArray(industries)) return [];

  return industries
    .map((industry) => {
      if (!industry || typeof industry !== "object") {
        return normalizeString(industry);
      }

      const name = normalizeString(industry.name);

      return name
        ? {
            id: normalizeNumber(industry.id),
            name,
          }
        : null;
    })
    .filter(Boolean);
};

const normalizeCompany = (company) => {
  if (!company || typeof company !== "object") {
    return normalizeString(company);
  }

  const name = normalizeString(company.name);

  return name
    ? {
        id: normalizeNumber(company.company_id || company.id),
        name,
      }
    : null;
};

const buildJobIndexPayload = (job = {}) => {
  return {
    id: normalizeNumber(job.id),
    name: normalizeString(job.name),
    description: normalizeString(job.description),
    job_requirement: normalizeString(job.job_requirement),
    job_benefit: normalizeString(job.job_benefit),
    location: normalizeString(job.location),
    exp_min: normalizeNumber(job.exp_min),
    exp_max: normalizeNumber(job.exp_max),
    company: normalizeCompany(job.company),
    industries: normalizeIndustries(job.industries),
  };
};

const indexJobInAI = async ({ job }) => {
  const payload = buildJobIndexPayload(job);

  if (payload.id === null) {
    throw new Error("job.id is required to index job in AI graph.");
  }

  const apiUrl = getJobIndexApiUrl();

  const response = await axios.post(apiUrl, payload, {
    headers: {
      "Content-Type": "application/json",
    },
    timeout: getJobIndexTimeoutMs(),
  });

  const responsePayload = response.data;

  if (responsePayload?.success === false) {
    throw new Error(
      responsePayload?.message ||
        responsePayload?.error ||
        "Job index API returned failure.",
    );
  }

  return responsePayload?.data || responsePayload;
};

const syncJobToAI = async ({ job, action = "upsert" }) => {
  try {
    const result = await indexJobInAI({ job });

    console.log("AI JOB INDEX SUCCESS:", {
      action,
      jobId: job?.id,
      result,
    });

    return result;
  } catch (error) {
    console.error("AI JOB INDEX ERROR:", {
      action,
      jobId: job?.id,
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    return null;
  }
};

module.exports = {
  indexJobInAI,
  syncJobToAI,
};
