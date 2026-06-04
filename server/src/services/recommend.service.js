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
};
