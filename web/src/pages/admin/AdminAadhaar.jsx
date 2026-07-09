import { useState, useEffect } from 'react';
import { AdminApi } from '../../api';
import { fetchFileObjectUrl, errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Button, Badge, Loader, Modal, ErrorState, ReasonModal } from '../../components/UI';

const FILTERS = ['pending', 'approved', 'rejected', ''];

export default function AdminAadhaar() {
  const [filter, setFilter] = useState('pending');
  const { data, loading, error, reload } = useAsync(() => AdminApi.aadhaarSubmissions(filter), [filter]);
  const [detailId, setDetailId] = useState(null);

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
            <thead><tr><th>User</th><th>Contact</th><th>Submitted</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {(data || []).length === 0 ? (
                <tr><td colSpan={5} className="muted" style={{ padding: 24 }}>No submissions.</td></tr>
              ) : data.map((s) => (
                <tr key={s.id}>
                  <td><b>{s.user_name}</b></td>
                  <td className="muted">{s.user_mobile}{s.user_email ? ` • ${s.user_email}` : ''}</td>
                  <td className="muted">{new Date(s.created_at).toLocaleString()}</td>
                  <td><Badge value={s.status} /></td>
                  <td><Button size="sm" variant="outline" onClick={() => setDetailId(s.id)}>Review</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!detailId} onClose={() => setDetailId(null)} title="Aadhaar verification" width={640}>
        {detailId && <Review id={detailId} onChanged={() => { reload(); }} onClose={() => setDetailId(null)} />}
      </Modal>
    </>
  );
}

function Review({ id, onChanged, onClose }) {
  const { data, loading } = useAsync(() => AdminApi.aadhaarSubmissionDetail(id), [id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [imgUrls, setImgUrls] = useState({}); // { front, back }
  const [reasonOpen, setReasonOpen] = useState(false);

  // Release preview blob URLs when the modal unmounts.
  useEffect(() => () => { Object.values(imgUrls).forEach((u) => URL.revokeObjectURL(u)); }, [imgUrls]);

  if (loading) return <Loader />;
  const s = data;

  const decide = async (status, reason) => {
    setBusy(true); setError('');
    try {
      await AdminApi.reviewAadhaar(id, status, reason);
      onChanged();
      onClose();
    } catch (e) { setError(errMessage(e)); setBusy(false); setReasonOpen(false); }
  };

  const viewImg = async (side) => {
    try {
      const rel = side === 'front' ? s.front_url : s.back_url;
      const absolute = `${location.protocol}//${location.hostname}:4000/api/v1/files/${rel}`;
      const objectUrl = await fetchFileObjectUrl(absolute);
      setImgUrls((u) => ({ ...u, [side]: objectUrl }));
    } catch (e) { setError(errMessage(e)); }
  };

  return (
    <div>
      {error && <div className="alert error">{error}</div>}
      <h3 style={{ fontSize: 18 }}>{s.user_name} <Badge value={s.status} /></h3>
      <p className="muted">{s.user_mobile}{s.user_email ? ` • ${s.user_email}` : ''}</p>

      <div className="section-title" style={{ marginTop: 16 }}>Aadhaar card photos</div>
      {['front', 'back'].map((side) => (
        <div key={side} className="card" style={{ background: '#FAFBFC', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ textTransform: 'capitalize' }}>{side}</span>
            <Button size="sm" variant="outline" onClick={() => viewImg(side)}>View photo</Button>
          </div>
          {imgUrls[side] && (
            <img src={imgUrls[side]} alt={`aadhaar ${side}`} style={{ width: '100%', marginTop: 10, borderRadius: 8 }} />
          )}
        </div>
      ))}

      {s.status === 'rejected' && s.rejection_reason && (
        <p className="muted" style={{ marginTop: 8 }}><b>Reason:</b> {s.rejection_reason}</p>
      )}

      <div className="divider" />
      <div style={{ display: 'flex', gap: 8 }}>
        {/* Only a pending submission can be decided (mirrors the backend guard). */}
        {s.status === 'pending' && (
          <>
            <Button variant="success" loading={busy} onClick={() => decide('approved')}>Approve</Button>
            <Button variant="danger" loading={busy} onClick={() => setReasonOpen(true)}>Reject</Button>
          </>
        )}
        <div style={{ flex: 1 }} />
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>

      <ReasonModal
        open={reasonOpen}
        title="Reject Aadhaar"
        label="Reason for rejection"
        confirmLabel="Reject"
        loading={busy}
        onConfirm={(reason) => decide('rejected', reason)}
        onClose={() => setReasonOpen(false)}
      />
    </div>
  );
}
