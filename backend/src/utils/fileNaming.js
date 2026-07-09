const path = require('path');
const fs = require('fs');
const { UPLOAD_ROOT } = require('../middleware/upload');

// Turn one label part into a safe, lowercase, filename-friendly slug.
function slugPart(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

/**
 * Rename a just-uploaded multer file to an identifiable name built from `parts`
 * (e.g. owner name + id + document type) plus a timestamp for uniqueness, so the
 * uploads folder is easy to track by whose document it is:
 *   "apollo-pharmacy_12_license_1720512345678.jpg"
 * Returns the new path relative to UPLOAD_ROOT (folder/filename). Falls back to
 * multer's original filename if the rename fails for any reason.
 */
function renameUpload(file, folder, parts) {
  const ext = path.extname(file.filename).toLowerCase();
  const prefix = (Array.isArray(parts) ? parts : [parts]).map(slugPart).filter(Boolean).join('_') || 'file';
  const filename = `${prefix}_${Date.now()}${ext}`;
  try {
    fs.renameSync(file.path, path.join(path.dirname(file.path), filename));
    return `${folder}/${filename}`;
  } catch (e) {
    return `${folder}/${file.filename}`;
  }
}

module.exports = { renameUpload, slugPart, UPLOAD_ROOT };
