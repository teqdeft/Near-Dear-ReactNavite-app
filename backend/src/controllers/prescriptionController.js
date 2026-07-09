const db = require('../db/knex');
const config = require('../config');
const { ok, created } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { PRESCRIPTION_STATUS } = require('../constants/enums');
const { renameUpload } = require('../utils/fileNaming');

const fileUrl = (p) => `${config.appUrl}/api/v1/files/${p}`;

// POST /prescriptions  (multipart: file, doctor_name?, prescription_date?)
const upload = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('A prescription file is required');
  // Snapshot the owner's name + mobile so the prescription stays identifiable
  // even if the user later edits their profile.
  const owner = await db('users').where({ id: req.user.id }).first();
  // Save under the patient's name + id for easy tracking.
  const relPath = renameUpload(req.file, 'prescriptions', [owner?.name, req.user.id, 'prescription']);
  const [id] = await db('prescriptions').insert({
    user_id: req.user.id,
    file_url: relPath,
    doctor_name: req.body.doctor_name || null,
    prescription_date: req.body.prescription_date || null,
    patient_name_snapshot: owner?.name || null,
    patient_mobile_snapshot: owner?.mobile || null,
    status: PRESCRIPTION_STATUS.UPLOADED,
  });
  const row = await db('prescriptions').where({ id }).first();
  return created(res, { ...row, url: fileUrl(row.file_url) }, 'Prescription uploaded');
});

// GET /prescriptions  — current user's prescriptions
const myPrescriptions = asyncHandler(async (req, res) => {
  const rows = await db('prescriptions').where({ user_id: req.user.id }).orderBy('id', 'desc');
  return ok(res, rows.map((r) => ({ ...r, url: fileUrl(r.file_url) })));
});

module.exports = { upload, myPrescriptions };
