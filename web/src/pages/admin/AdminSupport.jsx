import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Button, Badge, Loader, ErrorState } from '../../components/UI';
import { formatDateTime } from '../../utils/datetime';

const NEXT = { open: 'in_progress', in_progress: 'resolved', resolved: 'closed' };
const FILTERS = ['', 'open', 'in_progress', 'resolved', 'closed'];

export default function AdminSupport() {
  const [params] = useSearchParams();
  const [filter, setFilter] = useState(params.get('status') || '');
  const { data, loading, error, reload } = useAsync(() => AdminApi.tickets(filter), [filter]);
  const [busyId, setBusyId] = useState(null);

  const advance = async (t) => {
    const next = NEXT[t.status];
    if (!next) return;
    setBusyId(t.id);
    try { await AdminApi.updateTicket(t.id, next); reload(); }
    catch (e) { alert(errMessage(e)); }
    finally { setBusyId(null); }
  };

  const rows = data || [];

  return (
    <>
      <div className="toolbar">
        {FILTERS.map((f) => (
          <span key={f || 'all'} className={'tab' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>
            {f ? f[0].toUpperCase() + f.slice(1).replace('_', ' ') : 'All'}
          </span>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? <Loader /> : error ? <ErrorState message={errMessage(error)} onRetry={reload} /> : (
      <table className="table">
        <thead><tr><th>Subject</th><th>From</th><th>Topic</th><th>Status</th><th>Received on</th><th></th></tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={6} className="muted" style={{ padding: 24 }}>No support tickets.</td></tr>
          ) : rows.map((t) => (
            <tr key={t.id}>
              <td><b>{t.subject}</b><div className="muted">{t.message}</div></td>
              <td className="muted">{t.user_name || '—'}<br />{t.user_mobile}</td>
              <td><Badge value={t.related_type} /></td>
              <td><Badge value={t.status} /></td>
              <td className="muted">{formatDateTime(t.created_at)}</td>
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
        )}
      </div>
    </>
  );
}
