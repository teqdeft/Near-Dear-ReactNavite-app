import { Platform, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { NotificationApi } from '../api';

/**
 * FCM device registration.
 *
 * Every function here is best-effort and never throws: push is an enhancement on
 * top of the in-app notification list, which works regardless. A user on an
 * emulator without Play Services, or one who denied the permission, must still
 * get a working app — just without alerts in the tray.
 *
 * The token is remembered in memory so logout can unregister it. It is not
 * persisted: Firebase hands it back on demand, and a stale one from a previous
 * install would be worse than none.
 */
let currentToken = null;

// Android 13 (API 33) made notifications a runtime permission. Below that, and on
// iOS (which asks through Firebase itself), there is nothing to request here.
async function requestPermission() {
  if (Platform.OS !== 'android') {
    const status = await messaging().requestPermission();
    return status === messaging.AuthorizationStatus.AUTHORIZED
      || status === messaging.AuthorizationStatus.PROVISIONAL;
  }

  if (Platform.Version < 33) return true;

  const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Asks for permission, gets this device's FCM token and hands it to the backend.
 * Safe to call on every launch — re-registering the same token is the expected
 * case, since Firebase rotates tokens on its own schedule.
 */
export async function registerDevice() {
  try {
    // Permission is asked for, but registration does NOT depend on the answer.
    // POST_NOTIFICATIONS only suppresses the tray — FCM still delivers to the
    // process, and the in-app banner still draws. More importantly, the backend
    // row is keyed by token, so registering is what MOVES this device off the
    // previous user. Bailing out here on a denied permission would leave the row
    // pointing at whoever was signed in before, and they would keep receiving
    // their alerts — donor names, phone numbers — on this person's phone.
    await requestPermission();

    const token = await messaging().getToken();
    if (!token) return null;

    await NotificationApi.registerDevice(token, Platform.OS);
    currentToken = token;
    return token;
  } catch (e) {
    // Play Services missing (bare AOSP emulator), no network, backend down — all
    // survivable. The caller retries on the next foreground.
    return null;
  }
}

/**
 * Drops this device's token on logout, so the next person to sign in on this
 * phone does not receive the previous user's alerts.
 *
 * Must be called BEFORE the auth tokens are cleared — the endpoint is
 * authenticated, and after clearTokens() the request would 401.
 */
export async function unregisterDevice() {
  let token = currentToken;
  currentToken = null;

  // currentToken is only set by a SUCCESSFUL registration. If registration failed
  // earlier (offline launch), it is null — but a row for this device may still
  // exist on the backend from a previous session, still bound to this user. Ask
  // Firebase for the token directly rather than assuming there is nothing to drop.
  if (!token) {
    try { token = await messaging().getToken(); } catch (e) { return; }
  }
  if (!token) return;

  try {
    await NotificationApi.unregisterDevice(token);
  } catch (e) {
    /* logging out matters more than tidying up the token */
  }
}

/**
 * Firebase reissues tokens (app restore, reinstall, Play Services deciding to).
 * A token the backend was never told about is a phone that silently stops getting
 * alerts, so re-register whenever it changes.
 *
 * @returns {() => void} unsubscribe
 */
export function onTokenRefresh() {
  return messaging().onTokenRefresh(async (token) => {
    const old = currentToken;
    try {
      await NotificationApi.registerDevice(token, Platform.OS);
      currentToken = token;
      // Drop the superseded row. Without this the backend holds two addresses for
      // one device and sends every notification to it twice until the dead one is
      // pruned by a failed send.
      if (old && old !== token) await NotificationApi.unregisterDevice(old);
    } catch (e) {
      /* the next launch re-registers */
    }
  });
}

/**
 * Fires while the app is in the FOREGROUND. Android does not draw a tray
 * notification in this state — the app is already on screen — so there is nothing
 * to display; we just refresh the unread badge.
 *
 * @returns {() => void} unsubscribe
 */
export function onForegroundMessage(handler) {
  return messaging().onMessage(handler);
}

/**
 * Fires when a tray notification is tapped and the app was BACKGROUNDED (not
 * killed). The cold-start case is a separate call — getInitialNotification below.
 *
 * @returns {() => void} unsubscribe
 */
export function onNotificationOpened(handler) {
  return messaging().onNotificationOpenedApp(handler);
}

/**
 * The notification that cold-started the app, if any. Returns null on a normal
 * launch. Only meaningful once — Firebase clears it after the first read.
 */
export async function getInitialNotification() {
  try {
    return await messaging().getInitialNotification();
  } catch (e) {
    return null;
  }
}
