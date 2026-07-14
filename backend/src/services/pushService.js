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

// FCM tells us when an address is dead: the app was uninstalled, or the token was
// reissued. Those rows can never receive anything again, so drop them instead of
// retrying them on every future notification.
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * @param {number} userId
 * @param {{ title: string, message: string, type: string, referenceId: number|null }} payload
 */
async function sendToUser(userId, { title, message, type, referenceId }) {
  const fb = getApp();
  if (!fb) return;

  const rows = await db('device_tokens').where({ user_id: userId }).select('id', 'token');
  if (!rows.length) return; // user has never opened the app on a device, or logged out everywhere

  const res = await getMessaging(fb).sendEachForMulticast({
    tokens: rows.map((r) => r.token),

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
      },
    },
  });

  if (res.failureCount === 0) return;

  const dead = [];
  res.responses.forEach((r, i) => {
    if (r.success) return;
    const code = r.error?.code;
    if (DEAD_TOKEN_CODES.has(code)) dead.push(rows[i].id);
    else console.error('[push] send failed for token', rows[i].id, '-', code, r.error?.message);
  });

  if (dead.length) await db('device_tokens').whereIn('id', dead).del();
}

module.exports = { sendToUser };
