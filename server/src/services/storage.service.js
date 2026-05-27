const crypto = require("crypto");
const fs = require("fs");

const getCloudinaryConfig = () => {
  const cloudName = "duivufsyh";
  const apiKey = "861233939571958";
  const apiSecret = "mSDh5T_477E2v42dREbeSJFXiIo";
  const rootFolder = process.env.CLOUDINARY_UPLOAD_FOLDER || "recommendation-job";

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  return {
    apiKey,
    apiSecret,
    cloudName,
    rootFolder,
  };
};

const normalizeFolder = (folder) => {
  return String(folder || "files").replace(/^\/+|\/+$/g, "");
};

const buildSignature = (params, apiSecret) => {
  const payload = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(`${payload}${apiSecret}`)
    .digest("hex");
};

const isCloudStorageConfigured = () => {
  return Boolean(getCloudinaryConfig());
};

const isPdfFile = (file) => {
  return (
    file?.mimetype === "application/pdf" ||
    String(file?.originalname || file?.filename || "")
      .toLowerCase()
      .endsWith(".pdf")
  );
};

const uploadFileToStorage = async ({ file, folder }) => {
  const config = getCloudinaryConfig();

  if (!config) {
    throw new Error("Cloudinary storage is not configured.");
  }

  if (typeof fetch !== "function" || typeof FormData !== "function") {
    throw new Error("Node fetch/FormData API is not available for Cloudinary upload.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const targetFolder = `${normalizeFolder(config.rootFolder)}/${normalizeFolder(
    folder,
  )}`;
  const uploadParams = {
    folder: targetFolder,
    timestamp,
  };
  const signature = buildSignature(uploadParams, config.apiSecret);
  const fileBuffer = fs.readFileSync(file.path);
  const formData = new FormData();
  const resourceType = isPdfFile(file) ? "raw" : "auto";

  formData.append(
    "file",
    new Blob([fileBuffer], {
      type: file.mimetype || "application/octet-stream",
    }),
    file.originalname || file.filename,
  );
  formData.append("api_key", config.apiKey);
  formData.append("folder", targetFolder);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType}/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      `Cloudinary upload failed (${response.status}): ${
        data?.error?.message || JSON.stringify(data)
      }`,
    );
  }

  return data.secure_url;
};

const getCloudinaryAssetFromUrl = (fileUrl) => {
  const config = getCloudinaryConfig();

  if (!config || !fileUrl) return null;

  try {
    const url = new URL(fileUrl);

    if (url.hostname !== "res.cloudinary.com") return null;

    const parts = url.pathname.split("/").filter(Boolean);
    const cloudNameIndex = parts.indexOf(config.cloudName);

    if (cloudNameIndex === -1) return null;

    const resourceType = parts[cloudNameIndex + 1];
    const uploadSegment = parts[cloudNameIndex + 2];

    if (!resourceType || uploadSegment !== "upload") return null;

    const objectParts = parts.slice(cloudNameIndex + 3);
    const objectPathParts =
      objectParts[0]?.startsWith("v") && /^\d+$/.test(objectParts[0].slice(1))
        ? objectParts.slice(1)
        : objectParts;
    const filename = objectPathParts.pop();

    if (!filename) return null;

    const filenameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    const publicId = [
      ...objectPathParts,
      resourceType === "raw" ? filename : filenameWithoutExt,
    ].join("/");

    return {
      publicId,
      resourceType,
    };
  } catch (error) {
    return null;
  }
};

const deleteFileFromStorage = async (fileUrl) => {
  const config = getCloudinaryConfig();
  const asset = getCloudinaryAssetFromUrl(fileUrl);

  if (!config || !asset || typeof fetch !== "function") return false;

  const timestamp = Math.floor(Date.now() / 1000);
  const destroyParams = {
    public_id: asset.publicId,
    timestamp,
  };
  const signature = buildSignature(destroyParams, config.apiSecret);
  const formData = new FormData();

  formData.append("api_key", config.apiKey);
  formData.append("public_id", asset.publicId);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/${asset.resourceType}/destroy`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) return false;

  const data = await response.json().catch(() => null);

  return data?.result === "ok" || data?.result === "not found";
};

module.exports = {
  deleteCVFromStorage: deleteFileFromStorage,
  deleteFileFromStorage,
  isCloudStorageConfigured,
  uploadCVToStorage: ({ file, candidateId }) =>
    uploadFileToStorage({ file, folder: `cvs/candidates/${candidateId}` }),
  uploadFileToStorage,
};
