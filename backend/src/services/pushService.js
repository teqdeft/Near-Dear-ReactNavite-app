// firebase-admin v13+ dropped the old `admin.credential.cert()` / `admin.messaging()`
// namespaced API in favour of these modular entry points. Most FCM examples online
// still show the namespaced form; it throws "cannot read properties of undefined".
const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const db = require('../db/knex');
const config = require('../config');

/**
 * Sends FCM push to a user's registered devices.
 *
 * Push is an *optional* layer over the in-app notification: notificationService
 * writes the row first and then calls here. So every failure in this file is
 * swallowed — a dead FCM token, an expired key, Google being down. The user still
 * has their notification; they just have to open the app to see it. Letting a
 * push error bubble would abort the request that triggered it, which for a blood
 * or ambulance flow means failing the actual emergency to report a failed ping.
 */

// Firebase is initialised once, lazily, and only if a key was configured.
// `initialised` distinguishes "not tried yet" from "tried and unavailable" so a
// bad key logs once at first send rather than on every notification forever.
let app = null;
let initialised = false;

function getApp() {
  if (initialised) return app;
  initialised = true;

  if (!config.firebase.serviceAccountBase64) {
    // Expected in local dev and for contributors without Firebase access.
    console.warn('[push] FIREBASE_SERVICE_ACCOUNT_BASE64 not set — push disabled, notifications are in-app only');
    return null;
  }

  try {
    const json = Buffer.from(config.firebase.serviceAccountBase64, 'base64').toString('utf8');
    app = initializeApp({ credential: cert(JSON.parse(json)) });
    console.log('[push] Firebase initialised — push enabled');
  } catch (err) {
    console.error('[push] Firebase init failed — push disabled:', err.message);
    app = null;
  }
  return app;
}

// FCM says an address is dead — app uninstalled, or the token was reissued — with
// exactly these codes. Rows matching them can never receive anything again, so they
// are dropped rather than retried on every future notification.
//
// 'messaging/invalid-argument' is deliberately NOT in this list. It is FCM's
// catch-all for anything it disliked about the REQUEST, including faults in the
// message rather than the token. Treating it as a dead address means one malformed
// payload deletes every device a user owns, and they then receive nothing until the
// app happens to re-register.
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

// The message FCM actually carries. Shared by both send paths so a change to the
// channel, icon or priority cannot apply to one-off notifications but not fan-outs.
function buildMessage({ title, message, type, referenceId }) {
  return {
    // `notification` is what Android renders in the tray on its own while the app
    // is backgrounded. `data` is what the app reads on tap to decide which screen
    // to open — values must be strings, FCM rejects numbers and null.
    notification: { title, body: message },
    data: {
      type: String(type || ''),
      referenceId: referenceId == null ? '' : String(referenceId),
    },

    android: {
      // NearDear's notifications are ambulance dispatches and blood requests. On
      // 'normal' priority Android is free to hold them until the phone next wakes
      // — which under Doze can be hours. 'high' is what lets the alert through to
      // a screen-off, idle phone, and it is the whole point of the feature.
      priority: 'high',
      notification: {
        // Must match the channel the app creates. A channel id Android does not
        // know about means the notification is silently dropped on Android 8+.
        channelId: 'neardear_alerts',
        sound: 'default',

        // Android paints the small icon as a mask — it keeps the alpha and throws
        // the colour away — so this names a white-silhouette drawable, not the app
        // icon. Skip it and the status bar shows a featureless grey square.
        icon: 'ic_notification',
        color: '#16A34A',

        // These are alerts someone may need to act on without unlocking first: a
        // donor seeing a blood request, a driver seeing a dispatch. PRIVATE (the
        // default) hides the text on the lock screen, which for an emergency ping
        // defeats the purpose.
        visibility: 'public',
      },
    },
  };
}

// FCM caps a multicast at 500 tokens per call.
const FCM_BATCH = 500;

async function sendToTokenRows(rows, payload) {
  const fb = getApp();
  if (!fb || !rows.length) return;

  const messaging = getMessaging(fb);
  const dead = [];

  for (let i = 0; i < rows.length; i += FCM_BATCH) {
    const chunk = rows.slice(i, i + FCM_BATCH);
    // eslint-disable-next-line no-await-in-loop
    const res = await messaging.sendEachForMulticast({
      tokens: chunk.map((r) => r.token),
      ...buildMessage(payload),
    });

    if (res.failureCount === 0) continue;

    res.responses.forEach((r, j) => {
      if (r.success) return;
      const code = r.error?.code;
      if (DEAD_TOKEN_CODES.has(code)) dead.push(chunk[j].id);
      else console.error('[push] send failed for token', chunk[j].id, '-', code, r.error?.message);
    });
  }

  if (dead.length) await db('device_tokens').whereIn('id', dead).del();
}

/**
 * @param {number} userId
 * @param {{ title: string, message: string, type: string, referenceId: number|null }} payload
 */
async function sendToUser(userId, payload) {
  if (!getApp()) return;
  const rows = await db('device_tokens').where({ user_id: userId }).select('id', 'token');
  // No rows = the user has never opened the app on a device, or logged out everywhere.
  await sendToTokenRows(rows, payload);
}

/**
 * The same notification to many users, in ONE FCM round-trip rather than one per
 * user. A blood request can match a hundred donors; sending serially would have the
 * requester waiting on a hundred sequential HTTPS calls before their request even
 * returns.
 *
 * @param {number[]} userIds
 */
async function sendToUsers(userIds, payload) {
  if (!getApp() || !userIds.length) return;
  const rows = await db('device_tokens').whereIn('user_id', userIds).select('id', 'token');
  await sendToTokenRows(rows, payload);
}

module.exports = { sendToUser, sendToUsers };
