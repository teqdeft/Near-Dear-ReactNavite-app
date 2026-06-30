const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config');
const ApiError = require('../utils/ApiError');

// Ensure upload directory exists (private; served via authenticated route only).
const UPLOAD_ROOT = path.resolve(process.cwd(), config.uploads.dir);
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

function subDir(folder) {
  const dir = path.join(UPLOAD_ROOT, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    // Folder is decided by the route via req.uploadFolder (default 'misc').
    cb(null, subDir(req.uploadFolder || 'misc'));
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const id = crypto.randomBytes(16).toString('hex');
    cb(null, `${Date.now()}_${id}${ext}`);
  },
});

const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) {
    return cb(ApiError.badRequest(`Unsupported file type. Allowed: ${allowed.join(', ')}`));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.uploads.maxMb * 1024 * 1024 },
});

// Helper to set the destination folder before multer runs.
function intoFolder(folder) {
  return (req, res, next) => {
    req.uploadFolder = folder;
    next();
  };
}

module.exports = { upload, intoFolder, UPLOAD_ROOT };
