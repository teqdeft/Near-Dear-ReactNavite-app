import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationApi } from '../api';
import { errMessage } from '../api/client';
import { useAuth } from '../store/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { Button, Loader, ErrorState } from '../components/UI';
import Icon from '../components/Icon';

// Icon + accent colour per notification type.
const TYPE_ICON = {
  blood: { name: 'blood', color: 'var(--blood)' },
  medicine_order: { name: 'orders', color: 'var(--pharmacy)' },
  ambulance: { name: 'ambulance', color: 'var(--ambulance)' },
  admin: { name: 'audit', color: 'var(--primary)' },
  support: { name: 'support', color: 'var(--info)' },
};

// Where a notification should take the user when clicked (role-aware).
// Returns null when there's no meaningful destination (just mark it read).
function destinationFor(n, base) {
  const ref = n.reference_id;
  switch (n.type) {
    case 'medicine_order':
      return ref ? `${base}/orders?order=${ref}` : `${base}/orders`;
    case 'blood':
      return base === '/admin' ? '/admin/blood-requests' : null;
    case 'ambulance':
      return base === '/admin' ? '/admin/ambulance' : null;
    case 'support':
      return base === '/admin' ? '/admin/support' : null;
    case 'admin': {
      // 'admin' covers several review queues (pharmacy / ambulance / Aadhaar
      // registrations) — route by what the notification is about, not a default.
      if (base !== '/admin') return null;
      const text = `${n.title || ''} ${n.message || ''}`.toLowerCase();
      if (text.includes('ambulance') || text.includes('vehicle')) return '/admin/ambulance-vehicles';
      if (text.includes('aadhaar') || text.includes('kyc')) return '/admin/aadhaar';
      return '/admin/pharmacies';
    }
    default:
      return null;
  }
}

export default function NotificationsPage() {
  const { data, loading, error, reload } = useAsync(() => NotificationApi.list());
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const base = user?.role === 'admin' ? '/admin' : '/pharmacy';

  if (loading) return <Loader />;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;

  const items = data?.items || [];
  const unread = data?.unread || 0;

  const markAll = async () => {
    setBusy(true);
    try { await NotificationApi.markAllRead(); await reload(); }
    catch { /* ignore */ } finally { setBusy(false); }
  };

  // Clicking a notification marks it read, then opens the page it refers to.
  const openNotification = async (n) => {
    if (!n.is_read) {
      try { await NotificationApi.markRead(n.id); reload(); } catch { /* ignore */ }
    }
    const dest = destinationFor(n, base);
    if (dest) navigate(dest);
  };

  return (
    <>
      <div className="toolbar">
        <div className="spacer" />
        {unread > 0 && (
          <Button variant="outline" loading={busy} onClick={markAll}>Mark all read ({unread})</Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card muted" style={{ padding: 24, textAlign: 'center' }}>No notifications yet.</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {items.map((n) => (
            <div key={n.id} onClick={() => openNotification(n)}
              style={{
                display: 'flex', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                background: n.is_read ? 'transparent' : 'rgba(14,159,142,.06)',
              }}>
              <div style={{ flexShrink: 0, color: (TYPE_ICON[n.type] || {}).color || 'var(--muted)', display: 'flex' }}>
                <Icon name={(TYPE_ICON[n.type] || {}).name || 'bell'} size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: n.is_read ? 500 : 700, color: 'var(--text)' }}>{n.title}</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{n.message}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {String(n.created_at || '').slice(0, 16).replace('T', ' ')}
                </div>
              </div>
              {!n.is_read && <span style={{ width: 8, height: 8, borderRadius: 8, background: '#0E9F8E', marginTop: 6, flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
