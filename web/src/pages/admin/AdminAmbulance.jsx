import { useState } from 'react';
import { AdminApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Input, Button, Badge, Loader, Modal } from '../../components/UI';
import { formatDateTime } from '../../utils/datetime';
import { normalize, bestScore } from '../../utils/search';

export default function AdminAmbulance() {
  const [tab, setTab] = useState('fleet');
  return (
    <>
      <div className="tabs">
       <span className={'tab' + (tab === 'fleet' ? ' active' : '')} onClick={() => setTab('fleet')}>Fleet & drivers</span>
       <span className={'tab' + (tab === 'requests' ? ' active' : '')} onClick={() => setTab('requests')}>Requests</span>
      </div>
      {tab === 'requests' ? <Requests /> : <Fleet />}
    </>
  );
}

function Requests() {
  const { data, loading, reload } = useAsync(() => AdminApi.ambulanceRequests());
  const { data: ambulances, reload: reloadAmbulances } = useAsync(() => AdminApi.ambulances());
  const [assignFor, setAssignFor] = useState(null);
  const [search, setSearch] = useState('');

  if (loading) return <Loader />;
  const rows = data || [];
  // Only ambulances that aren't already on another trip can be assigned.
  const availableAmbulances = (ambulances || []).filter((a) => a.status === 'available');

  // Live, typo-tolerant filter over patient / mobile / pickup / drop.
  const queryNorm = normalize(search);
  const filtered = !queryNorm ? rows : rows
    .map((r) => ({ r, score: bestScore(queryNorm, [r.patient_name, r.contact_mobile, r.pickup_address, r.drop_address, ...String(r.patient_name || '').split(/\s+/)]) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.r.id - a.r.id)
    .map((x) => x.r);

  return (
    <>
      <div className="toolbar">
        <div className="spacer" />
        <input className="input" type="search" style={{ maxWidth: 260 }} placeholder="Search patient, mobile, address…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th>Patient</th><th>Pickup → Drop</th><th>Type</th><th>Status</th><th>Requested on</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="muted" style={{ padding: 24 }}>No ambulance requests.</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="muted" style={{ padding: 24 }}>No requests match “{search}”.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id}>
                <td><b>{r.patient_name}</b><div className="muted">{r.contact_mobile}</div></td>
                <td className="muted">{r.pickup_address} → {r.drop_address}</td>
                <td><Badge value={r.ambulance_type} /></td>
                <td><Badge value={r.status} /></td>
                <td className="muted">{formatDateTime(r.created_at)}</td>
                <td>
                  {['requested'].includes(r.status)
                    ? <Button size="sm" onClick={() => setAssignFor(r)}>Assign</Button>
                    : <span className="muted">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!assignFor} onClose={() => setAssignFor(null)} title="Assign ambulance">
        {assignFor && (
          <AssignForm request={assignFor} ambulances={availableAmbulances}
            onDone={() => { setAssignFor(null); reload(); reloadAmbulances(); }} />
        )}
      </Modal>
    </>
  );
}

function AssignForm({ request, ambulances, onDone }) {
  const [ambulanceId, setAmbulanceId] = useState(ambulances[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!ambulanceId) return setError('No free ambulances right now — every vehicle is already on a trip. Free one up or add a new vehicle in the Fleet tab.');
    setBusy(true); setError('');
    try {
      await AdminApi.assignAmbulance(request.id, { ambulance_id: Number(ambulanceId) });
      onDone();
    } catch (e) { setError(errMessage(e)); setBusy(false); }
  };

  return (
    <div>
      {error && <div className="alert error">{error}</div>}
      <p className="muted">Patient: <b>{request.patient_name}</b> • {request.ambulance_type}</p>
      <div className="field">
        <label>Choose ambulance (driver is notified automatically)</label>
        <select className="select" value={ambulanceId} onChange={(e) => setAmbulanceId(e.target.value)}>
          {ambulances.length === 0 && <option value="">No free ambulances available</option>}
          {ambulances.map((a) => (
            <option key={a.id} value={a.id}>{a.vehicle_number} • {a.ambulance_type} {a.driver_name ? `• ${a.driver_name}` : ''}</option>
          ))}
        </select>
      </div>
      <Button className="block" loading={busy} onClick={submit}>Assign ambulance</Button>
    </div>
  );
}

function Fleet() {
  const vehicles = useAsync(() => AdminApi.ambulances());
  const drivers = useAsync(() => AdminApi.drivers());
  const [modal, setModal] = useState(null); // 'provider' | 'vehicle' | 'driver'

  return (
    <>
      <div className="toolbar">
        <div className="spacer" />
        <Button variant="outline" onClick={() => setModal('provider')}>＋ Provider</Button>
        <Button variant="outline" onClick={() => setModal('driver')}>＋ Driver</Button>
        <Button onClick={() => setModal('vehicle')}>＋ Ambulance</Button>
      </div>

      <div className="card" style={{ padding: 0, marginBottom: 16 }}>
        <div className="section-title" style={{ padding: '14px 14px 0' }}>Ambulances</div>
        {vehicles.loading ? <Loader /> : (
          <table className="table">
            <thead><tr><th>Vehicle</th><th>Type</th><th>Driver</th><th>Status</th></tr></thead>
            <tbody>
              {(vehicles.data || []).length === 0 ? <tr><td colSpan={4} className="muted" style={{ padding: 18 }}>No ambulances yet.</td></tr> :
                vehicles.data.map((a) => (
                  <tr key={a.id}><td><b>{a.vehicle_number}</b></td><td><Badge value={a.ambulance_type} /></td>
                    <td>{a.driver_name || '—'} <span className="muted">{a.driver_mobile || ''}</span></td><td><Badge value={a.status} /></td></tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="section-title" style={{ padding: '14px 14px 0' }}>Driver accounts</div>
        {drivers.loading ? <Loader /> : (
          <table className="table">
            <thead><tr><th>Name</th><th>Mobile (login)</th><th>Status</th></tr></thead>
            <tbody>
              {(drivers.data || []).length === 0 ? <tr><td colSpan={3} className="muted" style={{ padding: 18 }}>No drivers yet.</td></tr> :
                drivers.data.map((d) => (
                  <tr key={d.id}><td>{d.name}</td><td className="muted">{d.mobile}</td><td><Badge value={d.status} /></td></tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modal === 'provider'} onClose={() => setModal(null)} title="Add ambulance provider">
        <ProviderForm onDone={() => { setModal(null); }} />
      </Modal>
      <Modal open={modal === 'driver'} onClose={() => setModal(null)} title="Create driver account">
        <DriverForm onDone={() => { setModal(null); drivers.reload(); }} />
      </Modal>
      <Modal open={modal === 'vehicle'} onClose={() => setModal(null)} title="Add ambulance">
        <VehicleForm drivers={drivers.data || []} onDone={() => { setModal(null); vehicles.reload(); }} />
      </Modal>
    </>
  );
}

function ProviderForm({ onDone }) {
  const [f, setF] = useState({ name: '', contact_mobile: '', city: '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async (e) => { e.preventDefault(); setBusy(true); setError('');
    try { await AdminApi.addProvider(f); onDone(); } catch (er) { setError(errMessage(er)); setBusy(false); } };
  return (
    <form onSubmit={submit}>
      {error && <div className="alert error">{error}</div>}
      <Input label="Provider name *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <Input label="Contact mobile *" value={f.contact_mobile} onChange={(e) => setF({ ...f, contact_mobile: e.target.value })} />
      <Input label="City *" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
      <Button className="block" loading={busy}>Add provider</Button>
    </form>
  );
}

function DriverForm({ onDone }) {
  const [f, setF] = useState({ name: '', mobile: '', password: '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async (e) => { e.preventDefault();
    if (!f.name || !f.mobile || f.password.length < 6) return setError('Name, mobile and a 6+ char password are required.');
    setBusy(true); setError('');
    try { await AdminApi.addDriver(f); onDone(); } catch (er) { setError(errMessage(er)); setBusy(false); } };
  return (
    <form onSubmit={submit}>
      {error && <div className="alert error">{error}</div>}
      <p className="muted" style={{ marginTop: -4, marginBottom: 12 }}>The driver logs into this same panel with their mobile + password.</p>
      <Input label="Driver name *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <Input label="Mobile (used to log in) *" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} />
      <Input label="Password *" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      <Button className="block" loading={busy}>Create driver</Button>
    </form>
  );
}

function VehicleForm({ drivers, onDone }) {
  const [f, setF] = useState({ vehicle_number: '', ambulance_type: 'basic', driver_user_id: '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async (e) => { e.preventDefault();
    if (!f.vehicle_number) return setError('Vehicle number is required.');
    setBusy(true); setError('');
    try {
      await AdminApi.addAmbulance({ ...f, driver_user_id: f.driver_user_id ? Number(f.driver_user_id) : undefined });
      onDone();
    } catch (er) { setError(errMessage(er)); setBusy(false); } };
  return (
    <form onSubmit={submit}>
      {error && <div className="alert error">{error}</div>}
      <Input label="Vehicle number *" value={f.vehicle_number} onChange={(e) => setF({ ...f, vehicle_number: e.target.value })} placeholder="MP09-AB-1234" />
      <div className="field">
        <label>Type</label>
        <select className="select" value={f.ambulance_type} onChange={(e) => setF({ ...f, ambulance_type: e.target.value })}>
          <option value="basic">Basic</option><option value="oxygen">Oxygen</option><option value="icu">ICU</option><option value="other">Other</option>
        </select>
      </div>
      <div className="field">
        <label>Assign driver (optional)</label>
        <select className="select" value={f.driver_user_id} onChange={(e) => setF({ ...f, driver_user_id: e.target.value })}>
          <option value="">— none —</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.mobile})</option>)}
        </select>
      </div>
      <Button className="block" loading={busy}>Add ambulance</Button>
    </form>
  );
}
