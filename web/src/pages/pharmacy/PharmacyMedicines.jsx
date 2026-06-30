import { useState } from 'react';
import { PharmacyApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Input, Button, Badge, Loader, Modal, money } from '../../components/UI';

export default function PharmacyMedicines() {
  const { data, loading, reload } = useAsync(() => PharmacyApi.medicines());
  const [open, setOpen] = useState(false);

  if (loading) return <Loader />;
  const rows = data || [];

  return (
    <>
      <div className="toolbar">
        <div className="section-title" style={{ margin: 0 }}>Your medicine listings</div>
        <div className="spacer" />
        <Button onClick={() => setOpen(true)}>＋ Add medicine</Button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th>Medicine</th><th>Price</th><th>MRP</th><th>Stock</th><th>Rx</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="muted" style={{ padding: 24 }}>No medicines listed yet. Click “Add medicine”.</td></tr>
            ) : rows.map((m) => <MedicineRow key={m.id} m={m} onChange={reload} />)}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add medicine">
        <AddMedicine onDone={() => { setOpen(false); reload(); }} />
      </Modal>
    </>
  );
}

function MedicineRow({ m, onChange }) {
  const [busy, setBusy] = useState(false);
  const name = m.master_name || m.custom_name;

  const toggleStock = async () => {
    setBusy(true);
    try {
      await PharmacyApi.updateMedicine(m.id, { stock_status: m.stock_status === 'in_stock' ? 'out_of_stock' : 'in_stock' });
      onChange();
    } finally { setBusy(false); }
  };
  const toggleActive = async () => {
    setBusy(true);
    try {
      await PharmacyApi.updateMedicine(m.id, { status: m.status === 'active' ? 'inactive' : 'active' });
      onChange();
    } finally { setBusy(false); }
  };

  return (
    <tr>
      <td><b>{name}</b>{m.strength ? <span className="muted"> • {m.strength}</span> : ''}</td>
      <td>{money(m.price)}</td>
      <td className="muted">{m.mrp ? money(m.mrp) : '—'}</td>
      <td><Badge value={m.stock_status} /></td>
      <td>{m.prescription_required ? <span className="badge red">Rx</span> : <span className="muted">No</span>}</td>
      <td><Badge value={m.status} /></td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <Button size="sm" variant="outline" onClick={toggleStock} loading={busy}>{m.stock_status === 'in_stock' ? 'Mark out' : 'Mark in'}</Button>{' '}
        <Button size="sm" variant="ghost" onClick={toggleActive} loading={busy}>{m.status === 'active' ? 'Disable' : 'Enable'}</Button>
      </td>
    </tr>
  );
}

function AddMedicine({ onDone }) {
  const [form, setForm] = useState({ custom_name: '', price: '', mrp: '', prescription_required: false, stock_status: 'in_stock' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.custom_name || !form.price) return setError('Name and price are required.');
    setBusy(true); setError('');
    try {
      await PharmacyApi.addMedicine({
        custom_name: form.custom_name, price: Number(form.price), mrp: form.mrp ? Number(form.mrp) : undefined,
        prescription_required: form.prescription_required, stock_status: form.stock_status,
      });
      onDone();
    } catch (err) { setError(errMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit}>
      {error && <div className="alert error">{error}</div>}
      <Input label="Medicine name *" value={form.custom_name} onChange={(e) => set('custom_name', e.target.value)} placeholder="e.g. Paracetamol 500mg" />
      <div className="row">
        <Input label="Price (₹) *" type="number" value={form.price} onChange={(e) => set('price', e.target.value)} />
        <Input label="MRP (₹)" type="number" value={form.mrp} onChange={(e) => set('mrp', e.target.value)} />
      </div>
      <div className="row" style={{ alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={form.prescription_required} onChange={(e) => set('prescription_required', e.target.checked)} />
          Prescription required
        </label>
        <div className="field" style={{ marginBottom: 0 }}>
          <select className="select" value={form.stock_status} onChange={(e) => set('stock_status', e.target.value)}>
            <option value="in_stock">In stock</option>
            <option value="out_of_stock">Out of stock</option>
          </select>
        </div>
      </div>
      <Button type="submit" loading={busy} className="block">Add medicine</Button>
    </form>
  );
}
