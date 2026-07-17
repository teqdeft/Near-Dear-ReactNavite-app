import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Badge, Loader, ErrorState } from '../../components/UI';
import { formatDateTime } from '../../utils/datetime';

const FILTERS = ['', 'open', 'matched', 'fulfilled', 'cancelled', 'expired'];

export default function AdminBloodRequests() {
  const [params] = useSearchParams();
  const [filter, setFilter] = useState(params.get('status') || '');
  const { data, loading, error, reload } = useAsync(() => AdminApi.bloodRequests(filter), [filter]);
  const rows = data || [];

  return (
    <>
      <div className="toolbar">
        {FILTERS.map((f) => (
          <span key={f || 'all'} className={'tab' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>
            {f ? f[0].toUpperCase() + f.slice(1) : 'All'}
          </span>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? <Loader /> : error ? <ErrorState message={errMessage(error)} onRetry={reload} /> : (
          <table className="table">
            <thead><tr><th>Patient</th><th>Group</th><th>Units</th><th>Hospital</th><th>City</th><th>Urgency</th><th>Status</th><th>Requested on</th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="muted" style={{ padding: 24 }}>No blood requests.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.patient_name}</b></td>
                  <td><span className="badge red">{r.blood_group_required}</span></td>
                  <td>{r.units_required}</td>
                  <td>{r.hospital_name}</td>
                  <td className="muted">{r.city}</td>
                  <td><Badge value={r.urgency_level} /></td>
                  <td><Badge value={r.status} /></td>
                  <td className="muted">{formatDateTime(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
