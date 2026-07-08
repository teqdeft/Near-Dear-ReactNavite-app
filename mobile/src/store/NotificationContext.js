import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { NotificationApi } from '../api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

// How often the tab-bar badge re-checks for new unread notifications while the
// app is in the foreground. There's no push/WebSocket infra yet, so this is a
// polling approximation of "real-time" — short enough that a new notification
// shows up on the badge within a few seconds without the user opening the
// notifications panel.
const POLL_MS = 10000;

// Keeps a single app-wide unread notification count so the "Alerts" tab can show
// a badge without every screen fetching it. Polls while logged in and refreshes
// when the app returns to the foreground; screens that read/clear notifications
// can push the new count via setUnread / refresh so the badge updates instantly.
export function NotificationProvider({ children }) {
  const { isLoggedIn } = useAuth();
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await NotificationApi.unreadCount();
      setUnread(Number(res?.unread || 0));
    } catch (e) {
      /* keep the last known count on a transient network error */
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) { setUnread(0); return undefined; }

    let timer = null;
    const startPolling = () => {
      if (timer) return;
      refresh();
      timer = setInterval(refresh, POLL_MS);
    };
    const stopPolling = () => {
      if (timer) { clearInterval(timer); timer = null; }
    };

    // Only poll while the app is actually visible — no point burning battery
    // and data checking every 10s while it's backgrounded.
    if (AppState.currentState === 'active') startPolling();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') startPolling(); else stopPolling();
    });

    return () => { stopPolling(); sub.remove(); };
  }, [isLoggedIn, refresh]);

  return (
    <NotificationContext.Provider value={{ unread, refresh, setUnread }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}

export default NotificationContext;
