const fs = require("fs");

const trimTrailingSlash = (value) => {
  return String(value || "").replace(/\/+$/, "");
};

const getSupabaseConfig = () => {
  const url = trimTrailingSlash(process.env.SUPABASE_URL);
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_STORAGE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "cvs";

  if (!url || !key || !bucket) {
    return null;
  }

  return {
    url,
    key,
    bucket,
  };
};

const encodeStoragePath = (storagePath) => {
  return storagePath.split("/").map(encodeURIComponent).join("/");
};

const isCloudStorageConfigured = () => {
  return Boolean(getSupabaseConfig());
};

const uploadCVToStorage = async ({ file, candidateId }) => {
  const config = getSupabaseConfig();

  if (!config) return null;

  if (typeof fetch !== "function") {
    throw new Error("Node fetch API is not available for Supabase upload.");
  }

  const objectPath = `candidates/${candidateId}/${file.filename}`;
  const uploadUrl = `${config.url}/storage/v1/object/${config.bucket}/${encodeStoragePath(
    objectPath,
  )}`;
  const fileBuffer = fs.readFileSync(file.path);

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": file.mimetype || "application/pdf",
      "x-upsert": "false",
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `Supabase upload failed (${response.status}): ${responseText}`,
    );
  }

  return `${config.url}/storage/v1/object/public/${config.bucket}/${encodeStoragePath(
    objectPath,
  )}`;
};

const deleteCVFromStorage = async (fileUrl) => {
  const config = getSupabaseConfig();

  if (!config || !fileUrl || typeof fetch !== "function") return false;

  const publicPrefix = `${config.url}/storage/v1/object/public/${config.bucket}/`;

  if (!String(fileUrl).startsWith(publicPrefix)) return false;

  const objectPath = decodeURIComponent(String(fileUrl).slice(publicPrefix.length));
  const deleteUrl = `${config.url}/storage/v1/object/${config.bucket}/${encodeStoragePath(
    objectPath,
  )}`;

  const response = await fetch(deleteUrl, {
    method: "DELETE",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
    },
  });

  return response.ok || response.status === 404;
};

module.exports = {
  deleteCVFromStorage,
  isCloudStorageConfigured,
  uploadCVToStorage,
};
