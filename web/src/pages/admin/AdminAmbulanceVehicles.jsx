import { useState, useEffect } from 'react';
import { AdminApi } from '../../api';
import { fetchFileObjectUrl, errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Button, Badge, Loader, Modal, ErrorState, ReasonModal } from '../../components/UI';
import { API_BASE_URL } from '../../config';

const FILTERS = ['', 'pending', 'approved', 'rejected'];

export default function AdminAmbulanceVehicles() {
  const [filter, setFilter] = useState('');
  const { data, loading, error, reload } = useAsync(() => AdminApi.ambulanceVehicles(filter), [filter]);
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
            <thead><tr><th>Vehicle</th><th>Driver</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {(data || []).length === 0 ? (
                <tr><td colSpan={4} className="muted" style={{ padding: 24 }}>No vehicles.</td></tr>
              ) : data.map((v) => (
                <tr key={v.id}>
                  <td><b>{v.vehicle_number}</b><div className="muted">{v.ambulance_type}</div></td>
                  <td>{v.driver_name}<div className="muted">{v.driver_mobile}</div></td>
                  <td><Badge value={v.approval_status} /></td>
                  <td><Button size="sm" variant="outline" onClick={() => setDetailId(v.id)}>Review</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!detailId} onClose={() => setDetailId(null)} title="Vehicle review" width={640}>
        {detailId && <Review id={detailId} onChanged={() => { reload(); }} onClose={() => setDetailId(null)} />}
      </Modal>
    </>
  );
}

function Review({ id, onChanged, onClose }) {
  const { data, loading } = useAsync(() => AdminApi.ambulanceVehicleDetail(id), [id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [docUrls, setDocUrls] = useState({});
  const [reasonFor, setReasonFor] = useState(null); // 'rejected'

  // Release document preview blob URLs when the review modal unmounts.
  useEffect(() => () => { Object.values(docUrls).forEach((u) => URL.revokeObjectURL(u)); }, [docUrls]);

  if (loading) return <Loader />;
  const { vehicle, documents } = data;

  const decide = async (status, reason) => {
    setBusy(true); setError('');
    try {
      await AdminApi.reviewAmbulanceVehicle(id, status, reason);
      onChanged();
      onClose();
    } catch (e) { setError(errMessage(e)); setBusy(false); setReasonFor(null); }
  };
  const onDecide = (status) => {
    if (status === 'rejected') setReasonFor(status);
    else decide(status);
  };

  const viewDoc = async (doc) => {
    try {
      const absolute = `${API_BASE_URL}/files/${doc.file_url}`;
      const objectUrl = await fetchFileObjectUrl(absolute);
      setDocUrls((u) => ({ ...u, [doc.id]: objectUrl }));
    } catch (e) { setError(errMessage(e)); }
  };

  return (
    <div>
      {error && <div className="alert error">{error}</div>}
      <h3 style={{ fontSize: 18 }}>{vehicle.vehicle_number} <Badge value={vehicle.approval_status} /></h3>
      <p className="muted">{vehicle.ambulance_type}</p>
      <table className="table" style={{ marginTop: 8 }}>
        <tbody>
          <tr><td className="muted">Driver</td><td>{vehicle.driver_name}</td></tr>
          <tr><td className="muted">Mobile</td><td>{vehicle.driver_mobile}</td></tr>
          <tr><td className="muted">Aadhaar KYC</td><td><Badge value={vehicle.aadhaar_kyc_status} /></td></tr>
        </tbody>
      </table>

      <div className="section-title" style={{ marginTop: 16 }}>Documents ({documents.length})</div>
      {documents.length === 0 ? <p className="muted">No documents uploaded.</p> : documents.map((d) => (
        <div key={d.id} className="card" style={{ background: '#FAFBFC', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ textTransform: 'capitalize' }}>{d.document_type.replace('_', ' ')} <Badge value={d.status} /></span>
            <Button size="sm" variant="outline" onClick={() => viewDoc(d)}>View file</Button>
          </div>
          {docUrls[d.id] && (
            d.file_url.toLowerCase().endsWith('.pdf')
              ? <a href={docUrls[d.id]} target="_blank" rel="noreferrer">Open PDF ↗</a>
              : <img src={docUrls[d.id]} alt="doc" style={{ width: '100%', marginTop: 10, borderRadius: 8 }} />
          )}
        </div>
      ))}

      <div className="divider" />
      <div style={{ display: 'flex', gap: 8 }}>
        {/* Only show decisions valid from the current state (mirrors backend
            guard) — no re-approving an approved vehicle or re-rejecting a
            rejected one. */}
        {vehicle.approval_status !== 'approved' && (
          <Button variant="success" loading={busy} onClick={() => onDecide('approved')}>Approve</Button>
        )}
        {vehicle.approval_status !== 'rejected' && (
          <Button variant="danger" loading={busy} onClick={() => onDecide('rejected')}>Reject</Button>
        )}
        <div style={{ flex: 1 }} />
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>

      <ReasonModal
        open={!!reasonFor}
        title="Reject vehicle"
        label="Reason for rejection"
        confirmLabel="Reject"
        loading={busy}
        onConfirm={(reason) => decide(reasonFor, reason)}
        onClose={() => setReasonFor(null)}
      />
    </div>
  );
}
