const path = require('path');
const fs = require('fs');
const db = require('../db/knex');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { UPLOAD_ROOT } = require('../middleware/upload');
const { ROLES } = require('../constants/enums');

/**
 * GET /files/*  — serve a private upload only to authorised users.
 * Blueprint compliance: prescription and pharmacy document files must stay private.
 */
const serve = asyncHandler(async (req, res) => {
  // The wildcard path, e.g. "prescriptions/12345.png"
  const relPath = req.params[0];
  if (!relPath || relPath.includes('..')) throw ApiError.badRequest('Invalid file path');

  const abs = path.join(UPLOAD_ROOT, relPath);
  if (!abs.startsWith(UPLOAD_ROOT) || !fs.existsSync(abs)) throw ApiError.notFound('File not found');

  const user = req.user;
  const isAdmin = user.role === ROLES.ADMIN;
  const isPharmacy = user.role === ROLES.PHARMACY_OWNER || user.role === ROLES.PHARMACY_STAFF;

  if (relPath.startsWith('prescriptions/')) {
    // Owner, any pharmacy (needs to review prescriptions), or admin.
    const presc = await db('prescriptions').where({ file_url: relPath }).first();
    const isOwner = presc && presc.user_id === user.id;
    if (!isAdmin && !isPharmacy && !isOwner) throw ApiError.forbidden();
  } else if (relPath.startsWith('pharmacy_docs/')) {
    // Admin or the pharmacy that owns the document.
    const doc = await db('pharmacy_documents as d')
      .join('pharmacies as p', 'p.id', 'd.pharmacy_id')
      .where('d.file_url', relPath)
      .select('p.owner_user_id')
      .first();
    const isOwner = doc && doc.owner_user_id === user.id;
    if (!isAdmin && !isOwner) throw ApiError.forbidden();
  }
  // Other folders (e.g. profile images) are accessible to any authenticated user.

  return res.sendFile(abs);
});

module.exports = { serve };
