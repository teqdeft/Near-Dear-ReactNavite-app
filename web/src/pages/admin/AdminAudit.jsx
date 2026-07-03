import { AdminApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Loader, ErrorState } from '../../components/UI';

export default function AdminAudit() {
  const { data, loading, error, reload } = useAsync(() => AdminApi.auditLogs());
  if (loading) return <Loader />;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;
  const rows = data || [];

  return (
    <div className="card" style={{ padding: 0 }}>
      <table className="table">
        <thead><tr><th>Action</th><th>Entity</th><th>Admin</th><th>When</th></tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={4} className="muted" style={{ padding: 24 }}>No audit entries yet.</td></tr>
          ) : rows.map((l) => (
            <tr key={l.id}>
              <td><b style={{ textTransform: 'capitalize' }}>{l.action.replace(/_/g, ' ')}</b></td>
              <td className="muted">{l.entity_type}{l.entity_id ? ` #${l.entity_id}` : ''}</td>
              <td>{l.admin_name || '—'}</td>
              <td className="muted">{String(l.created_at || '').slice(0, 16).replace('T', ' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
