import { useState, useMemo } from 'react';
import { AdminApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Button, Badge, Loader, ErrorState, Modal } from '../../components/UI';
import Icon from '../../components/Icon';
import { formatDateTime } from '../../utils/datetime';
import { normalize, bestScore } from '../../utils/search';

export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const { data, loading, error, reload } = useAsync(() => AdminApi.users({ limit: 1000 }), []);
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

  // Live, typo-tolerant filter (same idea as the pharmacy panel's medicine
  // search): the list narrows as the admin types — substring hits rank first,
  // and a misspelled word ("rahol" → "Rahul") still matches via edit distance.
  // Each word of the name is scored too, so a typo in either the first or
  // last name still finds the user.
  const users = data?.items || [];
  const filtered = useMemo(() => {
    const queryNorm = normalize(search);
    if (!queryNorm) return users;
    return users
      .map((u) => ({
        u,
        score: bestScore(queryNorm, [u.name, u.mobile, u.email, ...String(u.name || '').split(/\s+/)]),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.u.id - a.u.id)
      .map((x) => x.u);
  }, [users, search]);

  return (
    <>
      <div className="toolbar">
        <input className="input" type="search" style={{ maxWidth: 280 }} placeholder="Search name or mobile…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? <Loader /> : error ? <ErrorState message={errMessage(error)} onRetry={reload} /> : (
          <table className="table">
            <thead><tr><th>Name</th><th>Mobile</th><th>Role</th><th>KYC</th><th>Status</th><th>Joined on</th><th></th></tr></thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={7} className="muted" style={{ padding: 24 }}>No users found.</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="muted" style={{ padding: 24 }}>No users match “{search}”.</td></tr>
              ) : filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name || '—'}
                    {u.deletion_requested_at && <span className="badge red" style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="trash" size={12} /> Deletion requested</span>}
                  </td>
                  <td className="muted">{u.mobile}</td>
                  <td><Badge value={u.role} /></td>
                  <td>{u.aadhaar_kyc_status === 'verified' ? <Badge value="verified" /> : <span className="muted">{u.aadhaar_kyc_status}</span>}</td>
                  <td><Badge value={u.status} /></td>
                  <td className="muted">{formatDateTime(u.created_at)}</td>
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
      {data?.total != null && (
        <p className="muted" style={{ marginTop: 10 }}>
          {search ? `${filtered.length} of ${data.total} user(s)` : `${data.total} user(s)`}
        </p>
      )}

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
