import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { NotificationApi } from '../api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

// How often the tab-bar badge re-checks for new unread notifications.
const POLL_MS = 45000;

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
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => { clearInterval(timer); sub.remove(); };
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
