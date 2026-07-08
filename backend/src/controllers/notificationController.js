const db = require('../db/knex');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

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

module.exports = { list, unreadCount, markRead, markAllRead };
