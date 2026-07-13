const path = require('path');
const fs = require('fs');
const db = require('../db/knex');
const { ok, created } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { presentUser } = require('../utils/present');
const { normalizeCityList } = require('../utils/cityMatch');
const { UPLOAD_ROOT } = require('../middleware/upload');

// PUT /profile  — update name/email + extended profile fields
const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { name, email, gender, age, date_of_birth, blood_group, city, state, pincode,
    profile_image, emergency_contact_name, emergency_contact_mobile } = req.body;

  if (name !== undefined || email !== undefined) {
    await db('users').where({ id: userId }).update({
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email } : {}),
    });
  }

  // Drivers submit a list of service cities; everyone else a single one. Both
  // arrive as free text and are stored in the same comma-separated column.
  const profileFields = { gender, age, date_of_birth, blood_group,
    city: city === undefined ? undefined : normalizeCityList(city),
    state, pincode, profile_image, emergency_contact_name, emergency_contact_mobile };
  const cleaned = Object.fromEntries(Object.entries(profileFields).filter(([, v]) => v !== undefined));

  const existing = await db('user_profiles').where({ user_id: userId }).first();
  if (existing) {
    if (Object.keys(cleaned).length) await db('user_profiles').where({ user_id: userId }).update(cleaned);
  } else {
    await db('user_profiles').insert({ user_id: userId, ...cleaned });
  }

  const user = await db('users').where({ id: userId }).first();
  const profile = await db('user_profiles').where({ user_id: userId }).first();
  return ok(res, { user: presentUser(user), profile }, 'Profile updated');
});

// POST /profile/avatar  (multipart: file) — set / replace the user's profile picture
const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('An image file is required');
  // The shared upload filter also allows PDFs; a profile picture must be an image.
  if (!req.file.mimetype || !req.file.mimetype.startsWith('image/')) {
    fs.unlink(req.file.path, () => {});
    throw ApiError.badRequest('Profile picture must be an image (JPG, PNG or WEBP).');
  }

  // Save the file under a human-identifiable name — "<user-name>_<id>_<time>.<ext>"
  // — so it's clear whose photo it is when browsing the uploads folder. The name
  // is slugified (only a-z, 0-9, dashes) so it's always a safe filename.
  const ext = path.extname(req.file.filename).toLowerCase();
  const slug = String(req.user.name || 'user')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'user';
  const filename = `${slug}_${req.user.id}_${Date.now()}${ext}`;
  try {
    fs.renameSync(req.file.path, path.join(path.dirname(req.file.path), filename));
  } catch (e) {
    // If the rename fails for any reason, keep multer's original filename.
  }
  const relPath = `profiles/${fs.existsSync(path.join(path.dirname(req.file.path), filename)) ? filename : req.file.filename}`;
  const existing = await db('user_profiles').where({ user_id: req.user.id }).first();
  if (existing) {
    await db('user_profiles').where({ user_id: req.user.id }).update({ profile_image: relPath });
    // Best-effort: remove the previous image so old avatars don't pile up.
    if (existing.profile_image) fs.unlink(path.join(UPLOAD_ROOT, existing.profile_image), () => {});
  } else {
    await db('user_profiles').insert({ user_id: req.user.id, profile_image: relPath });
  }

  const profile = await db('user_profiles').where({ user_id: req.user.id }).first();
  return ok(res, { profile }, 'Profile picture updated');
});

// GET /profile/addresses
const listAddresses = asyncHandler(async (req, res) => {
  const rows = await db('user_addresses').where({ user_id: req.user.id }).orderBy('is_default', 'desc').orderBy('id', 'desc');
  return ok(res, rows);
});

// POST /profile/addresses
const addAddress = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { address_type, name, address_line_1, address_line_2, city, state, pincode, latitude, longitude, is_default } = req.body;

  if (is_default) {
    await db('user_addresses').where({ user_id: userId }).update({ is_default: false });
  }
  const [id] = await db('user_addresses').insert({
    user_id: userId, address_type, name, address_line_1, address_line_2,
    city, state, pincode, latitude, longitude, is_default: Boolean(is_default),
  });
  const row = await db('user_addresses').where({ id }).first();
  return created(res, row, 'Address added');
});

// DELETE /profile/addresses/:id
const deleteAddress = asyncHandler(async (req, res) => {
  const deleted = await db('user_addresses').where({ id: req.params.id, user_id: req.user.id }).del();
  if (!deleted) throw ApiError.notFound('Address not found');
  return ok(res, null, 'Address deleted');
});

// POST /profile/delete-request  — account deletion request (handled manually by admin in MVP)
const requestAccountDeletion = asyncHandler(async (req, res) => {
  await db('support_tickets').insert({
    user_id: req.user.id,
    related_type: 'general',
    subject: 'Account deletion request',
    message: req.body.reason || 'User requested account & data deletion.',
    status: 'open',
  });
  // Flag the user so the admin sees the pending deletion request in the dashboard.
  await db('users').where({ id: req.user.id }).update({ deletion_requested_at: db.fn.now() });
  return created(res, null, 'Account deletion request submitted. Our team will process it.');
});

module.exports = { updateProfile, uploadAvatar, listAddresses, addAddress, deleteAddress, requestAccountDeletion };
