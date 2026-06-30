const db = require('../db/knex');
const { ok, created } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { SUPPORT_STATUS } = require('../constants/enums');

// POST /support/tickets
const create = asyncHandler(async (req, res) => {
  const { related_type, related_id, subject, message } = req.body;
  const [id] = await db('support_tickets').insert({
    user_id: req.user.id,
    related_type: related_type || 'general',
    related_id: related_id || null,
    subject,
    message,
    status: SUPPORT_STATUS.OPEN,
  });
  const row = await db('support_tickets').where({ id }).first();
  return created(res, row, 'Support ticket created');
});

// GET /support/tickets  — current user's tickets
const myTickets = asyncHandler(async (req, res) => {
  const rows = await db('support_tickets').where({ user_id: req.user.id }).orderBy('id', 'desc');
  return ok(res, rows);
});

module.exports = { create, myTickets };
