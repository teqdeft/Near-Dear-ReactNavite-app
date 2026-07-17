import { useState, useMemo } from 'react';
import { AdminApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Badge, Loader, ErrorState } from '../../components/UI';
import { formatDate, formatDateTime } from '../../utils/datetime';
import { normalize, bestScore } from '../../utils/search';

const FILTERS = [
  { key: 'active', label: 'Active donors' },
  { key: 'all', label: 'All donors' },
];

export default function AdminDonors() {
  const [filter, setFilter] = useState('active');
  const [search, setSearch] = useState('');
  const { data, loading, error, reload } = useAsync(() => AdminApi.bloodDonors(filter === 'active'), [filter]);
  const rows = data || [];

  // Live, typo-tolerant filter over name / mobile / city / blood group.
  const filtered = useMemo(() => {
    const queryNorm = normalize(search);
    if (!queryNorm) return rows;
    return rows
      .map((d) => ({ d, score: bestScore(queryNorm, [d.name, d.mobile, d.city, d.blood_group, ...String(d.name || '').split(/\s+/)]) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.d.id - a.d.id)
      .map((x) => x.d);
  }, [rows, search]);

  return (
    <>
      <div className="toolbar">
        {FILTERS.map((f) => (
          <span key={f.key} className={'tab' + (filter === f.key ? ' active' : '')} onClick={() => setFilter(f.key)}>
            {f.label}
          </span>
        ))}
        <div className="spacer" />
        <input className="input" type="search" style={{ maxWidth: 240 }} placeholder="Search name, mobile, city…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? <Loader /> : error ? <ErrorState message={errMessage(error)} onRetry={reload} /> : (
          <table className="table">
            <thead><tr><th>Donor</th><th>Blood group</th><th>City</th><th>Availability</th><th>Last donation</th><th>Registered on</th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="muted" style={{ padding: 24 }}>No donors.</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="muted" style={{ padding: 24 }}>No donors match “{search}”.</td></tr>
              ) : filtered.map((donor) => (
                <tr key={donor.id}>
                  <td><b>{donor.name}</b><div className="muted">{donor.mobile}</div></td>
                  <td><Badge value={donor.blood_group} /></td>
                  <td className="muted">{donor.city}</td>
                  <td>
                    {donor.is_available && donor.status === 'active'
                      ? <Badge value="available" />
                      : <span className="muted">{donor.is_available ? donor.status : 'unavailable'}</span>}
                  </td>
                  <td className="muted">{donor.last_donation_date ? formatDate(donor.last_donation_date) : '—'}</td>
                  <td className="muted">{formatDateTime(donor.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
