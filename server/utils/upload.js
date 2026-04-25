const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const multer = require("multer");

const INLINE_UPLOAD_MODE = "inline";
const DISK_UPLOAD_MODE = "disk";
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/gif",
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".gif"]);

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getSafeImageExtension(filename) {
  const ext = path.extname(filename || "").toLowerCase();
  return ALLOWED_IMAGE_EXTENSIONS.has(ext) ? ext : ".png";
}

function getUploadStorageMode() {
  const rawMode = String(process.env.UPLOAD_STORAGE_MODE || "").trim().toLowerCase();
  if (rawMode === INLINE_UPLOAD_MODE) return INLINE_UPLOAD_MODE;
  if (rawMode === DISK_UPLOAD_MODE) return DISK_UPLOAD_MODE;
  return process.env.NETLIFY === "true" ? INLINE_UPLOAD_MODE : DISK_UPLOAD_MODE;
}

function isDiskUploadMode() {
  return getUploadStorageMode() === DISK_UPLOAD_MODE;
}

function buildUploadedImageUrl(file) {
  if (!file) return "";
  if (file.buffer?.length && file.mimetype) {
    return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
  }
  if (file.filename) {
    return `/uploads/${file.filename}`;
  }
  return "";
}

function createUploadMiddleware(uploadsDir) {
  const storage = isDiskUploadMode()
    ? (() => {
        ensureDir(uploadsDir);
        return multer.diskStorage({
          destination: (_req, _file, cb) => cb(null, uploadsDir),
          filename: (_req, file, cb) => {
            const safeExt = getSafeImageExtension(file?.originalname || "");
            cb(null, `p_${Date.now()}_${crypto.randomBytes(6).toString("hex")}${safeExt}`);
          },
        });
      })()
    : multer.memoryStorage();

  return multer({
    storage,
    limits: { fileSize: isDiskUploadMode() ? 10 * 1024 * 1024 : 4 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      cb(ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype) ? null : new Error("bad_file_type"), ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype));
    },
  });
}

module.exports = {
  createUploadMiddleware,
  ensureDir,
  getUploadStorageMode,
  isDiskUploadMode,
  buildUploadedImageUrl,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_IMAGE_EXTENSIONS,
};
