const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");

const DEFAULT_AI_SERVER_URL = "http://localhost:8000";

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

const extractCVFromFile = async ({ filePath, originalName, mimetype }) => {
  if (!filePath) {
    throw new Error("filePath is required to extract CV.");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error("CV file does not exist.");
  }

  const formData = new FormData();

  formData.append("file", fs.createReadStream(filePath), {
    filename: originalName || "cv.pdf",
    contentType: mimetype || "application/pdf",
  });

  const response = await axios.post(getCVExtractApiUrl(), formData, {
    headers: formData.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: getCVExtractTimeoutMs(),
  });

  const payload = response.data;

  if (payload?.success === false) {
    throw new Error(
      payload?.message || payload?.error || "CV extract API returned failure.",
    );
  }

  return normalizeExtractedCV(payload);
};

module.exports = {
  extractCVFromFile,
};
