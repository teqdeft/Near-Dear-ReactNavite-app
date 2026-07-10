import { useState } from 'react';
import { AdminApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Badge, Loader, ErrorState } from '../../components/UI';

const FILTERS = [
  { key: 'active', label: 'Active donors' },
  { key: 'all', label: 'All donors' },
];

export default function AdminDonors() {
  const [filter, setFilter] = useState('active');
  const { data, loading, error, reload } = useAsync(() => AdminApi.bloodDonors(filter === 'active'), [filter]);

  return (
    <>
      <div className="toolbar">
        {FILTERS.map((f) => (
          <span key={f.key} className={'tab' + (filter === f.key ? ' active' : '')} onClick={() => setFilter(f.key)}>
            {f.label}
          </span>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? <Loader /> : error ? <ErrorState message={errMessage(error)} onRetry={reload} /> : (
          <table className="table">
            <thead><tr><th>Donor</th><th>Blood group</th><th>City</th><th>Availability</th><th>Last donation</th></tr></thead>
            <tbody>
              {(data || []).length === 0 ? (
                <tr><td colSpan={5} className="muted" style={{ padding: 24 }}>No donors.</td></tr>
              ) : data.map((donor) => (
                <tr key={donor.id}>
                  <td><b>{donor.name}</b><div className="muted">{donor.mobile}</div></td>
                  <td><Badge value={donor.blood_group} /></td>
                  <td className="muted">{donor.city}</td>
                  <td>
                    {donor.is_available && donor.status === 'active'
                      ? <Badge value="available" />
                      : <span className="muted">{donor.is_available ? donor.status : 'unavailable'}</span>}
                  </td>
                  <td className="muted">{donor.last_donation_date ? new Date(donor.last_donation_date).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
