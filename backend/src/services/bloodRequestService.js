const db = require('../db/knex');
const { BLOOD_REQUEST_STATUS } = require('../constants/enums');

// A blood request auto-expires this many days after it is created if it is still
// active (nobody fulfilled or cancelled it) — this keeps dead requests out of
// donor lists and off the requester's active list.
const EXPIRY_DAYS = 10;

const ACTIVE_STATUSES = [BLOOD_REQUEST_STATUS.OPEN, BLOOD_REQUEST_STATUS.MATCHED];

/**
 * Best-effort bulk sweep: flip every active request older than EXPIRY_DAYS to
 * 'expired'. It is idempotent and cheap (blood_requests.status is indexed and
 * only open/matched rows are ever touched), so we call it at the top of the
 * blood read endpoints instead of standing up a separate cron/scheduler.
 */
async function expireStaleBloodRequests() {
  return db('blood_requests')
    .whereIn('status', ACTIVE_STATUSES)
    .whereRaw('created_at < (NOW() - INTERVAL ? DAY)', [EXPIRY_DAYS])
    .update({ status: BLOOD_REQUEST_STATUS.EXPIRED });
}

module.exports = { expireStaleBloodRequests, EXPIRY_DAYS };
