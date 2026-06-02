const DEFAULT_CV_EXTRACT_API_URL = "http://localhost:8000/extract-cv-url";

const getCVExtractApiUrl = () => {
  return (
    process.env.CV_EXTRACT_API_URL ||
    process.env.AI_CV_EXTRACT_API_URL ||
    DEFAULT_CV_EXTRACT_API_URL
  );
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

const normalizeBigIntId = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
};

const normalizeIndustryName = (industry) => {
  if (!industry) return null;

  if (typeof industry === "object") {
    return normalizeString(industry.name || industry.industry || industry.label);
  }

  return normalizeString(industry);
};

const normalizeIndustryId = (data) => {
  if (!data) return null;

  const industry = data.industry;

  if (typeof industry === "object") {
    return normalizeBigIntId(industry.id || industry.industry_id);
  }

  return normalizeBigIntId(data.id_industry || data.industry_id || industry);
};

const normalizeExtractedCV = (payload) => {
  const data = payload?.data || payload;

  return {
    cvText: normalizeString(data?.cv_text),
    industryId: normalizeIndustryId(data),
    industryName: normalizeIndustryName(data?.industry),
    degree: normalizeString(data?.degree),
    location: normalizeString(data?.location),
    expMin: normalizeInteger(data?.exp_min),
    expMax: normalizeInteger(data?.exp_max),
  };
};

const extractCVFromUrl = async (fileUrl) => {
  if (!fileUrl) {
    throw new Error("fileUrl is required to extract CV.");
  }

  if (typeof fetch !== "function") {
    throw new Error("Node fetch API is not available.");
  }

  const controller = new AbortController();
  const configuredTimeoutMs = Number(process.env.CV_EXTRACT_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0
      ? configuredTimeoutMs
      : 60000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(getCVExtractApiUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file_url: fileUrl,
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.success === false) {
      throw new Error(
        payload?.message ||
          payload?.error ||
          `CV extract API failed with status ${response.status}.`,
      );
    }

    return normalizeExtractedCV(payload);
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`CV extract API timeout after ${timeoutMs}ms.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = {
  extractCVFromUrl,
};
