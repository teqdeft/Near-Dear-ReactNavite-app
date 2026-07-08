import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NotificationApi } from '../api';
import Icon from './Icon';

// Topbar bell with a live unread badge. Polls every 60s and refreshes on
// navigation (so the count drops right after the user reads on the list page).
export default function NotificationBell({ base }) {
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();
  const loc = useLocation();

  const load = useCallback(async () => {
    try {
      const r = await NotificationApi.list();
      setUnread(r?.unread || 0);
    } catch { /* silent — a bell shouldn't break the topbar */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load, loc.pathname]);

  return (
    <button className="btn ghost sm" title="Notifications" style={{ position: 'relative' }}
      onClick={() => navigate(`${base}/notifications`)}>
      <Icon name="bell" size={19} />
      {unread > 0 && (
        <span style={{
          position: 'absolute', top: -5, right: -5, background: '#D64545', color: '#fff',
          borderRadius: 10, fontSize: 11, fontWeight: 700, minWidth: 17, height: 17,
          lineHeight: '17px', textAlign: 'center', padding: '0 4px',
        }}>
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}
