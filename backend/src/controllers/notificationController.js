const db = require('../db/knex');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// GET /notifications
const list = asyncHandler(async (req, res) => {
  const rows = await db('notifications').where({ user_id: req.user.id }).orderBy('id', 'desc').limit(100);
  const unread = await db('notifications').where({ user_id: req.user.id, is_read: false }).count('* as c').first();
  return ok(res, { items: rows, unread: Number(unread.c) });
});

// GET /notifications/unread-count  — lightweight count for the tab-bar badge
// (avoids fetching the full list just to render the number).
const unreadCount = asyncHandler(async (req, res) => {
  const row = await db('notifications').where({ user_id: req.user.id, is_read: false }).count('* as c').first();
  return ok(res, { unread: Number(row.c) });
});

// PUT /notifications/:id/read
const markRead = asyncHandler(async (req, res) => {
  await db('notifications').where({ id: req.params.id, user_id: req.user.id }).update({ is_read: true });
  return ok(res, null, 'Marked read');
});

// PUT /notifications/read-all
const markAllRead = asyncHandler(async (req, res) => {
  await db('notifications').where({ user_id: req.user.id, is_read: false }).update({ is_read: true });
  return ok(res, null, 'All marked read');
});

// POST /notifications/device-token  — the app hands us the FCM address of the
// device it is running on, so push has somewhere to go.
//
// Called on every launch, not just at login: Firebase rotates tokens on its own
// schedule, and a token we were never told about is a phone that silently stops
// receiving alerts. Re-registering the same token is therefore the normal case,
// not an error — hence the upsert.
const registerDevice = asyncHandler(async (req, res) => {
  const token = String(req.body.token || '').trim();
  const platform = String(req.body.platform || '').trim().toLowerCase();

  if (!token) throw ApiError.badRequest('token is required');
  if (!['android', 'ios'].includes(platform)) throw ApiError.badRequest('platform must be android or ios');

  // Conflict on `token`, not on (user_id, token): the token belongs to the
  // installation, so if someone else was previously signed in on this phone the
  // row must transfer to the current user. Without the user_id overwrite the
  // previous user would keep getting this phone's notifications.
  await db('device_tokens')
    .insert({
      user_id: req.user.id, token, platform, updated_at: db.fn.now(),
    })
    .onConflict('token')
    .merge(['user_id', 'platform', 'updated_at']);

  return ok(res, null, 'Device registered');
});

// DELETE /notifications/device-token  — on logout, so the next person to use this
// phone does not receive the previous user's alerts.
const unregisterDevice = asyncHandler(async (req, res) => {
  const token = String(req.body.token || '').trim();
  if (!token) throw ApiError.badRequest('token is required');

  // Scoped to the caller: a token is not a secret (the app that holds it can read
  // it), so without the user_id check anyone could unregister anyone's device.
  await db('device_tokens').where({ token, user_id: req.user.id }).del();

  return ok(res, null, 'Device unregistered');
});

module.exports = {
  list, unreadCount, markRead, markAllRead, registerDevice, unregisterDevice,
};
