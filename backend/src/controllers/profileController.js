const db = require('../db/knex');
const { ok, created } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { presentUser } = require('../utils/present');

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

  const profileFields = { gender, age, date_of_birth, blood_group, city, state, pincode,
    profile_image, emergency_contact_name, emergency_contact_mobile };
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
  return created(res, null, 'Account deletion request submitted. Our team will process it.');
});

module.exports = { updateProfile, listAddresses, addAddress, deleteAddress, requestAccountDeletion };
