import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Badge, Loader, ErrorState } from '../../components/UI';
import { formatDateTime } from '../../utils/datetime';
import { normalize, bestScore } from '../../utils/search';

const FILTERS = ['', 'open', 'matched', 'fulfilled', 'cancelled', 'expired'];

export default function AdminBloodRequests() {
  const [params] = useSearchParams();
  const [filter, setFilter] = useState(params.get('status') || '');
  const [search, setSearch] = useState('');
  const { data, loading, error, reload } = useAsync(() => AdminApi.bloodRequests(filter), [filter]);
  const rows = data || [];

  // Live, typo-tolerant filter over patient / hospital / city / blood group —
  // substring hits rank first, misspellings still match via edit distance.
  const filtered = useMemo(() => {
    const queryNorm = normalize(search);
    if (!queryNorm) return rows;
    return rows
      .map((r) => ({ r, score: bestScore(queryNorm, [r.patient_name, r.hospital_name, r.city, r.blood_group_required, ...String(r.patient_name || '').split(/\s+/)]) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.r.id - a.r.id)
      .map((x) => x.r);
  }, [rows, search]);

  return (
    <>
      <div className="toolbar">
        {FILTERS.map((f) => (
          <span key={f || 'all'} className={'tab' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>
            {f ? f[0].toUpperCase() + f.slice(1) : 'All'}
          </span>
        ))}
        <div className="spacer" />
        <input className="input" type="search" style={{ maxWidth: 240 }} placeholder="Search patient, hospital, city…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? <Loader /> : error ? <ErrorState message={errMessage(error)} onRetry={reload} /> : (
          <table className="table">
            <thead><tr><th>Patient</th><th>Group</th><th>Units</th><th>Hospital</th><th>City</th><th>Urgency</th><th>Status</th><th>Requested on</th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="muted" style={{ padding: 24 }}>No blood requests.</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="muted" style={{ padding: 24 }}>No requests match “{search}”.</td></tr>
              ) : filtered.map((r) => (
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
