import { useState } from 'react';
import { AdminApi } from '../../api';
import { fetchFileObjectUrl, errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Button, Badge, Loader, Modal } from '../../components/UI';

const FILTERS = ['', 'pending', 'approved', 'rejected', 'suspended'];

export default function AdminPharmacies() {
  const [filter, setFilter] = useState('');
  const { data, loading, reload } = useAsync(() => AdminApi.pharmacies(filter), [filter]);
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
        {loading ? <Loader /> : (
          <table className="table">
            <thead><tr><th>Pharmacy</th><th>City</th><th>License</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {(data || []).length === 0 ? (
                <tr><td colSpan={5} className="muted" style={{ padding: 24 }}>No pharmacies.</td></tr>
              ) : data.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.pharmacy_name}</b><div className="muted">{p.owner_name} • {p.mobile}</div></td>
                  <td>{p.city}</td>
                  <td className="muted">{p.license_number}</td>
                  <td><Badge value={p.approval_status} /></td>
                  <td><Button size="sm" variant="outline" onClick={() => setDetailId(p.id)}>Review</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={!!detailId} onClose={() => setDetailId(null)} title="Pharmacy review" width={640}>
        {detailId && <Review id={detailId} onChanged={() => { reload(); }} onClose={() => setDetailId(null)} />}
      </Modal>
    </>
  );
}

function Review({ id, onChanged, onClose }) {
  const { data, loading } = useAsync(() => AdminApi.pharmacyDetail(id), [id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [docUrls, setDocUrls] = useState({});

  if (loading) return <Loader />;
  const { pharmacy, documents } = data;

  const decide = async (status) => {
    let reason;
    if (status === 'rejected' || status === 'suspended') {
      reason = window.prompt(`Reason for ${status}?`) || '';
    }
    setBusy(true); setError('');
    try {
      await AdminApi.reviewPharmacy(id, status, reason);
      onChanged();
      onClose();
    } catch (e) { setError(errMessage(e)); setBusy(false); }
  };

  const viewDoc = async (doc) => {
    try {
      const absolute = `${location.protocol}//${location.hostname}:4000/api/v1/files/${doc.file_url}`;
      const objectUrl = await fetchFileObjectUrl(absolute);
      setDocUrls((u) => ({ ...u, [doc.id]: objectUrl }));
    } catch (e) { setError(errMessage(e)); }
  };

  return (
    <div>
      {error && <div className="alert error">{error}</div>}
      <h3 style={{ fontSize: 18 }}>{pharmacy.pharmacy_name} <Badge value={pharmacy.approval_status} /></h3>
      <p className="muted">{pharmacy.address}, {pharmacy.city} {pharmacy.pincode}</p>
      <table className="table" style={{ marginTop: 8 }}>
        <tbody>
          <tr><td className="muted">Owner</td><td>{pharmacy.owner_name}</td></tr>
          <tr><td className="muted">Mobile</td><td>{pharmacy.mobile}</td></tr>
          <tr><td className="muted">License</td><td>{pharmacy.license_number}</td></tr>
          <tr><td className="muted">GST</td><td>{pharmacy.gst_number || '—'}</td></tr>
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
        <Button variant="success" loading={busy} onClick={() => decide('approved')}>Approve</Button>
        <Button variant="danger" loading={busy} onClick={() => decide('rejected')}>Reject</Button>
        {pharmacy.approval_status === 'approved' && (
          <Button variant="ghost" loading={busy} onClick={() => decide('suspended')}>Suspend</Button>
        )}
        <div style={{ flex: 1 }} />
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}
