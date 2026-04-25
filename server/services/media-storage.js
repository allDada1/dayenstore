const path = require("path");
const crypto = require("crypto");
const { v2: cloudinary } = require("cloudinary");
const { buildUploadedImageUrl } = require("../utils/upload");

function getCloudinaryConfig() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();
  const folder = String(process.env.CLOUDINARY_FOLDER || "dayenstore").trim().replace(/^\/+|\/+$/g, "");

  return {
    cloudName,
    apiKey,
    apiSecret,
    folder: folder || "dayenstore",
  };
}

function isCloudinaryEnabled() {
  const cfg = getCloudinaryConfig();
  return Boolean(cfg.cloudName && cfg.apiKey && cfg.apiSecret);
}

function configureCloudinary() {
  const cfg = getCloudinaryConfig();
  cloudinary.config({
    cloud_name: cfg.cloudName,
    api_key: cfg.apiKey,
    api_secret: cfg.apiSecret,
    secure: true,
  });
  return cfg;
}

function buildPublicId(prefix = "image") {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

async function uploadBufferToCloudinary(file, options = {}) {
  const cfg = configureCloudinary();
  const folderParts = [cfg.folder, options.folder]
    .filter(Boolean)
    .map((part) => String(part).trim().replace(/^\/+|\/+$/g, ""));
  const folder = folderParts.join("/");
  const ext = path.extname(String(file?.originalname || "")).replace(/^\./, "").toLowerCase();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: buildPublicId(options.publicIdPrefix || "image"),
        resource_type: "image",
        format: ext || undefined,
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result?.secure_url || result?.url || "");
      }
    );

    stream.on("error", reject);
    stream.end(file.buffer);
  });
}

async function uploadPathToCloudinary(file, options = {}) {
  const cfg = configureCloudinary();
  const folderParts = [cfg.folder, options.folder]
    .filter(Boolean)
    .map((part) => String(part).trim().replace(/^\/+|\/+$/g, ""));
  const folder = folderParts.join("/");
  const ext = path.extname(String(file?.originalname || "")).replace(/^\./, "").toLowerCase();

  const result = await cloudinary.uploader.upload(String(file.path), {
    folder,
    public_id: buildPublicId(options.publicIdPrefix || "image"),
    resource_type: "image",
    format: ext || undefined,
  });

  return result?.secure_url || result?.url || "";
}

async function uploadImageFile(file, options = {}) {
  if (!file) return "";

  if (isCloudinaryEnabled()) {
    const cloudinaryUrl = file.buffer?.length
      ? await uploadBufferToCloudinary(file, options)
      : file.path
        ? await uploadPathToCloudinary(file, options)
        : "";
    if (cloudinaryUrl) return cloudinaryUrl;
  }

  return buildUploadedImageUrl(file);
}

module.exports = {
  getCloudinaryConfig,
  isCloudinaryEnabled,
  uploadImageFile,
};
