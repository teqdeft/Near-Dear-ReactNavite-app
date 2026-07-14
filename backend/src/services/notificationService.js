const db = require('../db/knex');
const push = require('./pushService');

/**
 * Creates an in-app notification row, then pushes it to the user's devices.
 *
 * The row is the source of truth and is written first; the push is a best-effort
 * ping on top of it. If FCM is unconfigured or fails, the notification still
 * exists and the app will show it on next open — so push failures never surface
 * to the caller, and never fail the blood/ambulance/order flow that triggered them.
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

async function notifyMany(userIds, payload) {
  await Promise.all(userIds.map((uid) => notify(uid, payload)));
}

module.exports = { notify, notifyMany };
