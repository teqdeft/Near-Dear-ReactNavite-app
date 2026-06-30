import { useState } from 'react';
import { AdminApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Button, Badge, Loader } from '../../components/UI';

const NEXT = { open: 'in_progress', in_progress: 'resolved', resolved: 'closed' };

export default function AdminSupport() {
  const { data, loading, reload } = useAsync(() => AdminApi.tickets());
  const [busyId, setBusyId] = useState(null);

  const advance = async (t) => {
    const next = NEXT[t.status];
    if (!next) return;
    setBusyId(t.id);
    try { await AdminApi.updateTicket(t.id, next); reload(); }
    catch (e) { alert(errMessage(e)); }
    finally { setBusyId(null); }
  };

  if (loading) return <Loader />;
  const rows = data || [];

  return (
    <div className="card" style={{ padding: 0 }}>
      <table className="table">
        <thead><tr><th>Subject</th><th>From</th><th>Topic</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={5} className="muted" style={{ padding: 24 }}>No support tickets.</td></tr>
          ) : rows.map((t) => (
            <tr key={t.id}>
              <td><b>{t.subject}</b><div className="muted">{t.message}</div></td>
              <td className="muted">{t.user_name || '—'}<br />{t.user_mobile}</td>
              <td><Badge value={t.related_type} /></td>
              <td><Badge value={t.status} /></td>
              <td>
                {NEXT[t.status]
                  ? <Button size="sm" variant="outline" loading={busyId === t.id} onClick={() => advance(t)}>
                      Mark {NEXT[t.status].replace('_', ' ')}
                    </Button>
                  : <span className="muted">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
