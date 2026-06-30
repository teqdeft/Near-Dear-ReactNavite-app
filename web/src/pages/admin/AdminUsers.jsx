import { useState } from 'react';
import { AdminApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Button, Badge, Loader } from '../../components/UI';

export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { data, loading, reload } = useAsync(() => AdminApi.users({ search: query || undefined, limit: 50 }), [query]);
  const [busyId, setBusyId] = useState(null);

  const toggle = async (u) => {
    setBusyId(u.id);
    try {
      await AdminApi.setUserStatus(u.id, u.status === 'blocked' ? 'active' : 'blocked');
      reload();
    } catch (e) { alert(errMessage(e)); }
    finally { setBusyId(null); }
  };

  return (
    <>
      <div className="toolbar">
        <input className="input" style={{ maxWidth: 280 }} placeholder="Search name or mobile…"
          value={search} onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setQuery(search)} />
        <Button variant="outline" onClick={() => setQuery(search)}>Search</Button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? <Loader /> : (
          <table className="table">
            <thead><tr><th>Name</th><th>Mobile</th><th>Role</th><th>KYC</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {(data?.items || []).length === 0 ? (
                <tr><td colSpan={6} className="muted" style={{ padding: 24 }}>No users found.</td></tr>
              ) : data.items.map((u) => (
                <tr key={u.id}>
                  <td>{u.name || '—'}</td>
                  <td className="muted">{u.mobile}</td>
                  <td><Badge value={u.role} /></td>
                  <td>{u.aadhaar_kyc_status === 'verified' ? <Badge value="verified" /> : <span className="muted">{u.aadhaar_kyc_status}</span>}</td>
                  <td><Badge value={u.status} /></td>
                  <td>
                    <Button size="sm" variant={u.status === 'blocked' ? 'success' : 'danger'} loading={busyId === u.id} onClick={() => toggle(u)}>
                      {u.status === 'blocked' ? 'Unblock' : 'Block'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {data?.total != null && <p className="muted" style={{ marginTop: 10 }}>{data.total} user(s)</p>}
    </>
  );
}
