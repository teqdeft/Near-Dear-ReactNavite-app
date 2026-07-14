import React, {
  createContext, useContext, useEffect, useState, useCallback, useRef,
} from 'react';
import { AppState } from 'react-native';
import { NotificationApi } from '../api';
import * as Push from '../services/push';
import NotificationBanner from '../components/NotificationBanner';
import { navigateWhenReady } from '../navigation/navigationRef';
import { notificationTarget, fromPushMessage } from '../utils/notificationTarget';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

// Backstop only. Push is what makes the badge react promptly; this catches what
// push cannot reach — permission denied, no Play Services, a token that went stale
// between refreshes, a push Android dropped under Doze.
//
// Deliberately slow: every screen showing server data has pull-to-refresh, so a
// user who suspects something is waiting can get the answer instantly. Polling is
// only the lazy fallback for a user sitting still.
const POLL_MS = 5 * 60 * 1000;

// Keeps a single app-wide unread notification count so the "Alerts" tab can show a
// badge without every screen fetching it. Also owns this device's FCM registration
// and the foreground banner — badge, push and banner are three views of the same
// event, and this provider is already scoped to "logged in", which is exactly when
// a device token should exist.
export function NotificationProvider({ children }) {
  const { isLoggedIn, isDriver, user, donor } = useAuth();
  const isDonor = !!donor || user?.role === 'donor';
  const isPharmacyOwner = user?.role === 'pharmacy_owner';
  const [unread, setUnread] = useState(0);
  const [banner, setBanner] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await NotificationApi.unreadCount();
      setUnread(Number(res?.unread || 0));
    } catch (e) {
      /* keep the last known count on a transient network error */
    }
  }, []);

  // Roles decide where a notification lands (a driver's ambulance alert opens their
  // trips list, a user's opens the request detail). Held in a ref so the push
  // listeners below can read the CURRENT roles without being torn down and
  // re-subscribed every time the user object changes — re-subscribing mid-session
  // is how a notification arriving at that moment gets dropped.
  const roles = useRef({ isDriver, isDonor, isPharmacyOwner });
  roles.current = { isDriver, isDonor, isPharmacyOwner };

  const openNotification = useCallback((item) => {
    const target = notificationTarget(item, roles.current);
    if (target) navigateWhenReady(target.screen, target.params);
  }, []);

  // Register this device with the backend, and keep the registration current.
  //
  // Retried on every foreground, not just at login: registerDevice() swallows its
  // errors, so a launch with no signal (lift, metro, plane) leaves the device
  // registered nowhere — and without a retry it would receive nothing at all for
  // the rest of the process's life. Re-registering an already-registered token is
  // the cheap, expected case (the backend upserts), so retrying costs nothing.
  useEffect(() => {
    if (!isLoggedIn) return undefined;

    Push.registerDevice();
    const unsubToken = Push.onTokenRefresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') Push.registerDevice();
    });

    return () => { unsubToken(); sub.remove(); };
  }, [isLoggedIn]);

  // React to pushes. Every path re-asks the server for the count rather than
  // trusting the payload: a push says "something happened", not "your unread count
  // is now N", and pushes can be dropped or arrive out of order. The server is the
  // only thing that actually knows.
  useEffect(() => {
    if (!isLoggedIn) return undefined;

    let cancelled = false;

    // Arrived while the app is open. Android draws nothing in the tray in this
    // state, so without the banner the only signal would be a tab badge quietly
    // incrementing — which is how a driver misses a dispatch.
    const unsubMessage = Push.onForegroundMessage((msg) => {
      refresh();
      setBanner({
        // Distinct per arrival so a second alert landing while the first is still
        // on screen re-triggers the entrance animation instead of silently
        // swapping the text under the user's eyes.
        key: msg.messageId || String(Date.now()),
        title: msg.notification?.title || 'NearDear',
        message: msg.notification?.body || '',
        ...fromPushMessage(msg),
      });
    });

    // Tray notification tapped while the app was backgrounded.
    const unsubOpened = Push.onNotificationOpened((msg) => {
      refresh();
      openNotification(fromPushMessage(msg));
    });

    // Tapped while the app was killed — this launch IS the tap. The navigator is
    // not mounted yet, so navigateWhenReady holds the target until it is.
    //
    // `cancelled` guards a logout landing between the call and its resolution: the
    // stack the target lives in is gone by then, and navigating into it throws.
    Push.getInitialNotification().then((msg) => {
      if (!msg || cancelled) return;
      refresh();
      openNotification(fromPushMessage(msg));
    });

    return () => { cancelled = true; unsubMessage(); unsubOpened(); };
  }, [isLoggedIn, refresh, openNotification]);

  useEffect(() => {
    if (!isLoggedIn) { setUnread(0); setBanner(null); return undefined; }

    let timer = null;
    const startPolling = () => {
      if (timer) return;
      refresh();
      timer = setInterval(refresh, POLL_MS);
    };
    const stopPolling = () => {
      if (timer) { clearInterval(timer); timer = null; }
    };

    // Only poll while the app is actually visible — no point burning battery and
    // data while it's backgrounded.
    if (AppState.currentState === 'active') startPolling();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') startPolling(); else stopPolling();
    });

    return () => { stopPolling(); sub.remove(); };
  }, [isLoggedIn, refresh]);

  return (
    <NotificationContext.Provider value={{ unread, refresh, setUnread }}>
      {children}
      <NotificationBanner
        notification={banner}
        onPress={() => { const b = banner; setBanner(null); if (b) openNotification(b); }}
        onDismiss={() => setBanner(null)}
      />
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}

export default NotificationContext;
