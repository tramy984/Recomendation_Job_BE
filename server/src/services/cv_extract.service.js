const axios = require("axios");

const DEFAULT_AI_SERVER_URL =
  "https://model-recomendation-job-ejfhexetfhg3faeq.southeastasia-01.azurewebsites.net/";

const getCVExtractApiUrl = () => {
  const apiUrl = process.env.CV_EXTRACT_API_URL;

  if (apiUrl) {
    return apiUrl;
  }

  const serverUrl = (
    process.env.AI_SERVER_URL ||
    process.env.AI_CV_EXTRACT_SERVER_URL ||
    DEFAULT_AI_SERVER_URL
  ).replace(/\/+$/, "");

  return `${serverUrl}/extract-cv-file`;
};

const getCVExtractTimeoutMs = () => {
  const configuredTimeoutMs = Number(process.env.CV_EXTRACT_TIMEOUT_MS);

  return Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0
    ? configuredTimeoutMs
    : 60000;
};

const normalizeString = (value) => {
  if (value === undefined || value === null) return null;

  const text = String(value).trim();
  return text || null;
};

const normalizeInteger = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const number = Number(value);

  return Number.isInteger(number) ? number : null;
};

const normalizeExtractedCV = (payload) => {
  const data = payload?.data || payload;

  return {
    cvText: normalizeString(data?.cv_text),
    industryName: normalizeString(data?.industry),
    degree: normalizeString(data?.degree),
    location: normalizeString(data?.location),
    expMin: normalizeInteger(data?.exp_min),
    expMax: normalizeInteger(data?.exp_max),
  };
};

const extractCVFromUrl = async ({ fileUrl }) => {
  if (!fileUrl) {
    throw new Error("fileUrl is required to extract CV.");
  }

  const apiUrl = getCVExtractApiUrl();

  console.log("CV EXTRACT API URL:", apiUrl);
  console.log("CV FILE URL:", fileUrl);

  try {
    const response = await axios.post(
      apiUrl,
      {
        file_url: fileUrl,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: getCVExtractTimeoutMs(),
      },
    );

    const payload = response.data;

    console.log("AI EXTRACT RAW PAYLOAD:", JSON.stringify(payload, null, 2));

    if (payload?.success === false) {
      throw new Error(
        payload?.message ||
          payload?.error ||
          "CV extract API returned failure.",
      );
    }

    const normalized = normalizeExtractedCV(payload);

    console.log("AI EXTRACT NORMALIZED:", normalized);

    return normalized;
  } catch (error) {
    console.log("AI EXTRACT REQUEST ERROR:");

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
  extractCVFromUrl,
};
