const db = require('../db/knex');

/**
 * Creates an in-app notification row. (Push via FCM can be layered on later
 * without changing call sites — this is the single choke point.)
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
  return id;
}

async function notifyMany(userIds, payload) {
  await Promise.all(userIds.map((uid) => notify(uid, payload)));
}

module.exports = { notify, notifyMany };
