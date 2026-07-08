import { useState } from 'react';
import { AdminApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Button, Badge, Loader, ErrorState, Modal } from '../../components/UI';
import Icon from '../../components/Icon';

export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { data, loading, error, reload } = useAsync(() => AdminApi.users({ search: query || undefined, limit: 50 }), [query]);
  const [busyId, setBusyId] = useState(null);
  const [confirming, setConfirming] = useState(null); // user pending deletion
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState('');

  const toggle = async (u) => {
    setBusyId(u.id);
    try {
      await AdminApi.setUserStatus(u.id, u.status === 'blocked' ? 'active' : 'blocked');
      reload();
    } catch (e) { alert(errMessage(e)); }
    finally { setBusyId(null); }
  };

  const remove = async () => {
    setDeleting(true); setDelErr('');
    try {
      await AdminApi.deleteUser(confirming.id);
      setConfirming(null);
      reload();
    } catch (e) { setDelErr(errMessage(e)); }
    finally { setDeleting(false); }
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
        {loading ? <Loader /> : error ? <ErrorState message={errMessage(error)} onRetry={reload} /> : (
          <table className="table">
            <thead><tr><th>Name</th><th>Mobile</th><th>Role</th><th>KYC</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {(data?.items || []).length === 0 ? (
                <tr><td colSpan={6} className="muted" style={{ padding: 24 }}>No users found.</td></tr>
              ) : data.items.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name || '—'}
                    {u.deletion_requested_at && <span className="badge red" style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="trash" size={12} /> Deletion requested</span>}
                  </td>
                  <td className="muted">{u.mobile}</td>
                  <td><Badge value={u.role} /></td>
                  <td>{u.aadhaar_kyc_status === 'verified' ? <Badge value="verified" /> : <span className="muted">{u.aadhaar_kyc_status}</span>}</td>
                  <td><Badge value={u.status} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {u.status !== 'deleted' && (
                      <>
                        <Button size="sm" variant={u.status === 'blocked' ? 'success' : 'danger'} loading={busyId === u.id} onClick={() => toggle(u)}>
                          {u.status === 'blocked' ? 'Unblock' : 'Block'}
                        </Button>{' '}
                        <Button size="sm" variant="danger" onClick={() => { setDelErr(''); setConfirming(u); }}>Delete</Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {data?.total != null && <p className="muted" style={{ marginTop: 10 }}>{data.total} user(s)</p>}

      <Modal open={!!confirming} onClose={() => setConfirming(null)} title="" width={400}>
        <div style={{ width: '100%', textAlign: 'center', padding: '4px 4px 2px' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FDEAEA', color: '#E03131', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><Icon name="trash" size={26} /></div>
          <h3 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 8px' }}>Delete this account?</h3>
          <p className="muted" style={{ margin: '0 0 8px', lineHeight: 1.55 }}>
            <b style={{ color: 'var(--text)' }}>{confirming?.name || confirming?.mobile}</b> and <b style={{ color: 'var(--text)' }}>all their data</b>
            {' '}(profile, requests, orders, prescriptions) will be permanently deleted. This can’t be undone.
          </p>
          {delErr && <div className="alert error" style={{ marginBottom: 12 }}>{delErr}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn" onClick={() => setConfirming(null)} disabled={deleting}
              style={{ flex: 1, minWidth: 0, background: '#F1F3F5', color: 'var(--text)' }}>Cancel</button>
            <Button variant="danger" onClick={remove} loading={deleting} style={{ flex: 1, minWidth: 0 }}>Delete account</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
