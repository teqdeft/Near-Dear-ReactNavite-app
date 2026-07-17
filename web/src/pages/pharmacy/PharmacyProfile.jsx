import { useState } from 'react';
import { PharmacyApi, AuthApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Input, TextArea, Button, Badge, Loader } from '../../components/UI';
import MapPicker from '../../components/MapPicker';
import { formatDateTime } from '../../utils/datetime';

// The two documents a pharmacy must submit for approval. (GST / store photo
// were removed to keep onboarding simple for now.)
const DOC_TYPES = [
  { key: 'license', label: 'Drug license' },
  { key: 'owner_id', label: 'Owner ID proof' },
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
            Your documents have been submitted and are under review by our team. You’ll be notified once your
            pharmacy is approved — this usually takes 24–48 hours. Make sure both required documents are uploaded below.
          </div>
        )}
        {pharmacy.approval_status === 'approved' && (
          <div className="alert" style={{ marginTop: 14, background: '#E6F6EA', color: '#1E6B33' }}>
            Your pharmacy is verified and approved. You can now list medicines and receive orders.
          </div>
        )}
        {pharmacy.approval_status === 'rejected' && (
          <div className="alert error" style={{ marginTop: 14 }}>
            {pharmacy.rejection_reason ? `Not approved: ${pharmacy.rejection_reason}. ` : ''}
            Please review, re-upload the required documents below, and your pharmacy will be sent for approval again.
          </div>
        )}
        {pharmacy.approval_status === 'suspended' && (
          <div className="alert error" style={{ marginTop: 14 }}>
            Your pharmacy has been temporarily suspended and is not receiving orders. Please contact support for assistance.
          </div>
        )}
      </div>

      <div className="card">
        <div className="section-title">Shop details & location</div>
        <EditDetails pharmacy={pharmacy} onSaved={reload} />
      </div>

      <div className="card">
        <div className="section-title">Documents</div>
        <div className="muted" style={{ marginBottom: 12, marginTop: -6 }}>
          Both a <b>Drug license</b> and an <b>Owner ID proof</b> are required for approval.
        </div>
        <table className="table">
          <thead><tr><th>Type</th><th>Status</th><th>Uploaded</th></tr></thead>
          <tbody>
            {documents.length === 0 ? (
              <tr><td colSpan={3} className="muted">No documents uploaded yet.</td></tr>
            ) : documents.map((d) => (
              <tr key={d.id}>
                <td style={{ textTransform: 'capitalize' }}>{d.document_type.replace('_', ' ')}</td>
                <td><Badge value={d.status} /></td>
                <td className="muted">{formatDateTime(d.uploaded_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="divider" />
        <UploadDoc onUploaded={reload} approved={pharmacy.approval_status === 'approved'} />
      </div>

      <div className="card">
        <div className="section-title">Change password</div>
        <ChangePassword />
      </div>
    </>
  );
}

function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!currentPassword || !newPassword || !confirmPassword) return setError('Please fill all fields.');
    if (newPassword.length < 6) return setError('New password must be at least 6 characters.');
    if (newPassword !== confirmPassword) return setError('New password and confirmation do not match.');
    setLoading(true);
    try {
      await AuthApi.changePassword({ currentPassword, newPassword });
      setSuccess('Password updated.');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) { setError(errMessage(err)); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} style={{ maxWidth: 480 }}>
      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">Password updated.</div>}
      <Input label="Current password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      <Input label="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      <Input label="Confirm new password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      <Button type="submit" loading={loading}>Update password</Button>
    </form>
  );
}

function UploadDoc({ onUploaded, approved }) {
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
      <div className="section-title" style={{ fontSize: 15 }}>Upload / replace a document</div>
      <div className="muted" style={{ marginBottom: 12 }}>
        Uploading a document <b>replaces</b> the existing one of that type (e.g. a renewed drug license).
        {approved && ' Since your pharmacy is approved, re-uploading sends it for re-approval — you won’t receive new orders until an admin re-approves.'}
      </div>
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
    latitude: null, longitude: null,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    for (const k of ['pharmacy_name', 'owner_name', 'mobile', 'license_number', 'address', 'city']) {
      if (!form[k]) return setError('Please fill all required (*) fields.');
    }
    // Without a pin we can only match this shop by city name, so it stays
    // invisible to nearby customers in an adjacent town. Insist on it up front.
    if (form.latitude == null || form.longitude == null) {
      return setError('Please pin your shop on the map — customers are matched to pharmacies near them.');
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

      <MapPicker
        value={form.latitude != null ? { latitude: form.latitude, longitude: form.longitude } : null}
        onChange={(c) => setForm((f) => ({ ...f, latitude: c.latitude, longitude: c.longitude }))}
      />

      <Button type="submit" loading={busy}>Submit for approval</Button>
    </form>
  );
}

// Edit an already-registered pharmacy. License / GST are intentionally absent:
// those were approved against the uploaded documents, and changing them needs a
// re-upload (which sends the pharmacy back for review).
function EditDetails({ pharmacy, onSaved }) {
  const [form, setForm] = useState({
    pharmacy_name: pharmacy.pharmacy_name || '',
    owner_name: pharmacy.owner_name || '',
    mobile: pharmacy.mobile || '',
    email: pharmacy.email || '',
    address: pharmacy.address || '',
    city: pharmacy.city || '',
    state: pharmacy.state || '',
    pincode: pharmacy.pincode || '',
    latitude: pharmacy.latitude != null ? Number(pharmacy.latitude) : null,
    longitude: pharmacy.longitude != null ? Number(pharmacy.longitude) : null,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.pharmacy_name || !form.address || !form.city) {
      return setError('Pharmacy name, address and city are required.');
    }
    setBusy(true);
    try {
      await PharmacyApi.updateMe(form);
      setSuccess('Saved.');
      onSaved();
    } catch (err) { setError(errMessage(err)); }
    finally { setBusy(false); }
  };

  const pinned = form.latitude != null && form.longitude != null;

  return (
    <form onSubmit={submit} style={{ maxWidth: 720 }}>
      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}
      {!pinned && (
        <div className="alert info" style={{ marginBottom: 12 }}>
          Your shop isn’t pinned on the map yet. Until it is, customers in nearby towns
          won’t find you — only those who typed the exact same city name.
        </div>
      )}
      <div className="row">
        <Input label="Pharmacy name *" value={form.pharmacy_name} onChange={(e) => set('pharmacy_name', e.target.value)} />
        <Input label="Owner name" value={form.owner_name} onChange={(e) => set('owner_name', e.target.value)} />
      </div>
      <div className="row">
        <Input label="Mobile" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
        <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
      </div>
      <TextArea label="Address *" value={form.address} onChange={(e) => set('address', e.target.value)} />
      <div className="row">
        <Input label="City *" value={form.city} onChange={(e) => set('city', e.target.value)} />
        <Input label="State" value={form.state} onChange={(e) => set('state', e.target.value)} />
        <Input label="Pincode" value={form.pincode} onChange={(e) => set('pincode', e.target.value)} />
      </div>

      <MapPicker
        value={pinned ? { latitude: form.latitude, longitude: form.longitude } : null}
        onChange={(c) => setForm((f) => ({ ...f, latitude: c.latitude, longitude: c.longitude }))}
      />

      <Button type="submit" loading={busy}>Save changes</Button>
    </form>
  );
}
