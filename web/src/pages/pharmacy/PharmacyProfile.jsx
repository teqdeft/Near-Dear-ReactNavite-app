import { useState } from 'react';
import { PharmacyApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Input, TextArea, Button, Badge, Loader } from '../../components/UI';

const DOC_TYPES = [
  { key: 'license', label: 'Drug license' },
  { key: 'owner_id', label: 'Owner ID proof' },
  { key: 'gst', label: 'GST certificate' },
  { key: 'store_photo', label: 'Store photo' },
];

export default function PharmacyProfile() {
  const { data, loading, reload } = useAsync(() => PharmacyApi.me());
  const pharmacy = data?.pharmacy;
  const documents = data?.documents || [];

  if (loading) return <Loader />;
  if (!pharmacy) return <RegisterForm onDone={reload} />;

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: 20 }}>{pharmacy.pharmacy_name}</h2>
            <div className="muted" style={{ marginTop: 4 }}>{pharmacy.address}, {pharmacy.city} {pharmacy.pincode}</div>
            <div className="muted">License: {pharmacy.license_number}{pharmacy.gst_number ? ` • GST: ${pharmacy.gst_number}` : ''}</div>
          </div>
          <Badge value={pharmacy.approval_status} />
        </div>
        {pharmacy.approval_status === 'pending' && (
          <div className="alert info" style={{ marginTop: 14 }}>
            Your pharmacy is awaiting admin approval. Upload your documents below to speed things up.
          </div>
        )}
        {pharmacy.approval_status === 'rejected' && pharmacy.rejection_reason && (
          <div className="alert error" style={{ marginTop: 14 }}>Rejected: {pharmacy.rejection_reason}. Please re-upload documents.</div>
        )}
      </div>

      <div className="card">
        <div className="section-title">Documents</div>
        <table className="table">
          <thead><tr><th>Type</th><th>Status</th><th>Uploaded</th></tr></thead>
          <tbody>
            {documents.length === 0 ? (
              <tr><td colSpan={3} className="muted">No documents uploaded yet.</td></tr>
            ) : documents.map((d) => (
              <tr key={d.id}>
                <td style={{ textTransform: 'capitalize' }}>{d.document_type.replace('_', ' ')}</td>
                <td><Badge value={d.status} /></td>
                <td className="muted">{String(d.uploaded_at || '').slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="divider" />
        <UploadDoc onUploaded={reload} />
      </div>
    </>
  );
}

function UploadDoc({ onUploaded }) {
  const [type, setType] = useState('license');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const upload = async () => {
    if (!file) return setError('Choose a file first.');
    setBusy(true); setError('');
    try {
      const fd = new FormData();
      fd.append('document_type', type);
      fd.append('file', file);
      await PharmacyApi.uploadDocument(fd);
      setFile(null);
      onUploaded();
    } catch (e) { setError(errMessage(e)); }
    finally { setBusy(false); }
  };

  return (
    <div>
      {error && <div className="alert error">{error}</div>}
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Document type</label>
          <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
            {DOC_TYPES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>File (image or PDF)</label>
          <input className="input" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files[0])} style={{ paddingTop: 8 }} />
        </div>
        <div style={{ flex: '0 0 auto' }}>
          <Button onClick={upload} loading={busy}>Upload</Button>
        </div>
      </div>
    </div>
  );
}

function RegisterForm({ onDone }) {
  const [form, setForm] = useState({
    pharmacy_name: '', owner_name: '', mobile: '', email: '', license_number: '',
    gst_number: '', address: '', city: '', state: '', pincode: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    for (const k of ['pharmacy_name', 'owner_name', 'mobile', 'license_number', 'address', 'city']) {
      if (!form[k]) return setError('Please fill all required (*) fields.');
    }
    setBusy(true); setError('');
    try {
      await PharmacyApi.register(form);
      onDone();
    } catch (err) { setError(errMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <form className="card" onSubmit={submit} style={{ maxWidth: 720 }}>
      <div className="section-title">Register your pharmacy</div>
      <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>Step 2 of 2 — pharmacy details. Submitted for admin approval.</p>
      {error && <div className="alert error">{error}</div>}
      <div className="row">
        <Input label="Pharmacy name *" value={form.pharmacy_name} onChange={(e) => set('pharmacy_name', e.target.value)} />
        <Input label="Owner name *" value={form.owner_name} onChange={(e) => set('owner_name', e.target.value)} />
      </div>
      <div className="row">
        <Input label="Mobile *" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
        <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
      </div>
      <div className="row">
        <Input label="Drug license number *" value={form.license_number} onChange={(e) => set('license_number', e.target.value)} />
        <Input label="GST number" value={form.gst_number} onChange={(e) => set('gst_number', e.target.value)} />
      </div>
      <TextArea label="Address *" value={form.address} onChange={(e) => set('address', e.target.value)} />
      <div className="row">
        <Input label="City *" value={form.city} onChange={(e) => set('city', e.target.value)} />
        <Input label="State" value={form.state} onChange={(e) => set('state', e.target.value)} />
        <Input label="Pincode" value={form.pincode} onChange={(e) => set('pincode', e.target.value)} />
      </div>
      <Button type="submit" loading={busy}>Submit for approval</Button>
    </form>
  );
}
