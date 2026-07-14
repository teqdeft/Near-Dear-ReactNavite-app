const db = require('../db/knex');
const push = require('./pushService');

/**
 * Creates an in-app notification row, then pushes it to the user's devices.
 *
 * The row is the source of truth and is written first; the push is a best-effort
 * ping on top of it. If FCM is unconfigured or fails, the notification still
 * exists and the app shows it on next open — so push failures never surface to the
 * caller, and never fail the blood/ambulance/order flow that triggered them.
 */
async function notify(userId, { title, message, type = 'admin', referenceId = null }) {
  if (!userId) return null;
  const [id] = await db('notifications').insert({
    user_id: userId,
    title,
    message,
    type,
    reference_id: referenceId,
  });

  try {
    await push.sendToUser(userId, { title, message, type, referenceId });
  } catch (err) {
    console.error('[push] send failed for user', userId, '-', err.message);
  }

  return id;
}

/**
 * The same notification to many users — a blood request fanning out to every
 * matching donor, an ambulance request to every nearby driver.
 *
 * NOT a loop over notify(). That would issue one INSERT and one FCM round-trip per
 * recipient, in parallel: a request matching 80 donors would open 80 concurrent
 * connections against a pool of 10 (config.db.poolMax), and a pool-acquire timeout
 * there throws out of the Promise.all and 500s the request — *after* the blood
 * request and its match rows are already committed. The caller sees a failure for a
 * request that exists and whose donors were half-notified.
 *
 * So: one bulk INSERT, and one multicast for the whole audience. Constant DB and
 * network cost regardless of how many donors match, on a path where the caller is
 * standing in a hospital waiting for the response.
 */
async function notifyMany(userIds, { title, message, type = 'admin', referenceId = null }) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;

  await db('notifications').insert(ids.map((user_id) => ({
    user_id,
    title,
    message,
    type,
    reference_id: referenceId,
  })));

  try {
    await push.sendToUsers(ids, { title, message, type, referenceId });
  } catch (err) {
    console.error('[push] fan-out send failed for', ids.length, 'users -', err.message);
  }
}

module.exports = { notify, notifyMany };
