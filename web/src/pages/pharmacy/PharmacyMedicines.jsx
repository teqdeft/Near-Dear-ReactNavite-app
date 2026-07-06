import { useState } from 'react';
import { PharmacyApi, CatalogApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Input, Button, Badge, Loader, Modal, money, ErrorState } from '../../components/UI';

export default function PharmacyMedicines() {
  const { data, loading, error, reload } = useAsync(() => PharmacyApi.medicines());
  const { data: catData, reload: reloadCategories } = useAsync(() => CatalogApi.categories());
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  if (loading) return <Loader />;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;
  const rows = data || [];
  const categories = catData || [];

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter((m) => {
        const name = (m.master_name || m.custom_name || '').toLowerCase();
        const strength = (m.strength || '').toLowerCase();
        const category = (m.category_name || '').toLowerCase();
        return name.includes(q) || strength.includes(q) || category.includes(q);
      })
    : rows;

  const lowStockCount = rows.filter((m) => m.status === 'active' && m.quantity_available != null && m.quantity_available <= 10).length;

  return (
    <>
      <div className="toolbar">
        <div className="section-title" style={{ margin: 0 }}>Your medicine listings</div>
        <div className="spacer" />
        <input
          className="input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Search by name or category…"
          style={{ maxWidth: 260 }}
          disabled={rows.length === 0}
        />
        <Button onClick={() => setOpen(true)}>＋ Add medicine</Button>
      </div>

      {lowStockCount > 0 && (
        <div className="alert" style={{ background: '#FFF4E5', color: '#8A5300', marginBottom: 12 }}>
          ⚠️ {lowStockCount} medicine(s) low on stock.
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th>Medicine</th><th>Category</th><th>Price</th><th>MRP</th><th>Qty</th><th>Stock</th><th>Rx</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="muted" style={{ padding: 24 }}>No medicines listed yet. Click “Add medicine”.</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="muted" style={{ padding: 24 }}>No medicines match “{query}”.</td></tr>
            ) : filtered.map((m) => (
              <MedicineRow key={m.id} m={m} categories={categories} onReloadCategories={reloadCategories} onChange={reload} />
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add medicine">
        <AddMedicine categories={categories} onReloadCategories={reloadCategories} onDone={() => { setOpen(false); reload(); }} />
      </Modal>
    </>
  );
}

function MedicineRow({ m, categories, onReloadCategories, onChange }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState('');
  const name = m.master_name || m.custom_name;
  const lowStock = m.quantity_available != null && m.quantity_available <= 10;

  const toggleStock = async () => {
    setBusy(true); setErr('');
    try {
      await PharmacyApi.updateMedicine(m.id, { stock_status: m.stock_status === 'in_stock' ? 'out_of_stock' : 'in_stock' });
      onChange();
    } catch (e) { setErr(errMessage(e)); } finally { setBusy(false); }
  };
  const toggleActive = async () => {
    setBusy(true); setErr('');
    try {
      await PharmacyApi.updateMedicine(m.id, { status: m.status === 'active' ? 'inactive' : 'active' });
      onChange();
    } catch (e) { setErr(errMessage(e)); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setErr('');
    try {
      await PharmacyApi.deleteMedicine(m.id);
      setConfirming(false);
      onChange();
    } catch (e) { setErr(errMessage(e)); } finally { setBusy(false); }
  };

  return (
    <tr>
      <td><b>{name}</b>{m.strength ? <span className="muted"> • {m.strength}</span> : ''}</td>
      <td className="muted">{m.category_name || '—'}</td>
      <td>{money(m.price)}</td>
      <td className="muted">{m.mrp ? money(m.mrp) : '—'}</td>
      <td className={lowStock ? undefined : 'muted'}>
        {lowStock
          ? <span className="badge amber">{m.quantity_available} left</span>
          : (m.quantity_available ?? '—')}
      </td>
      <td><Badge value={m.stock_status} /></td>
      <td>{m.prescription_required ? <span className="badge red">Rx</span> : <span className="muted">No</span>}</td>
      <td><Badge value={m.status} /></td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit</Button>{' '}
        <Button size="sm" variant="outline" onClick={toggleStock} loading={busy} style={{ minWidth: 82 }}>{m.stock_status === 'in_stock' ? 'Mark out' : 'Mark in'}</Button>{' '}
        <Button size="sm" variant="ghost" onClick={toggleActive} loading={busy} style={{ minWidth: 72 }}>{m.status === 'active' ? 'Disable' : 'Enable'}</Button>{' '}
        <Button size="sm" variant="danger" onClick={() => setConfirming(true)} loading={busy}>Delete</Button>
        {err && <div className="badge red" style={{ marginTop: 6, whiteSpace: 'normal' }}>{err}</div>}
        <Modal open={editing} onClose={() => setEditing(false)} title={`Edit — ${name}`}>
          <EditMedicine m={m} categories={categories} onReloadCategories={onReloadCategories} onDone={() => { setEditing(false); onChange(); }} />
        </Modal>
        <Modal
  open={confirming}
  onClose={() => setConfirming(false)}
  title=""
  width="min(360px, calc(100vw - 32px))"
>
  <div
    style={{
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      textAlign: 'center',
      padding: '4px 4px 2px',
      overflowX: 'hidden',
    }}
  >
    <div
      aria-hidden="true"
      style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: '#FDEAEA',
        color: '#E03131',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 24,
        marginBottom: 18,
        boxShadow: '0 0 0 7px #FCF4F4',
      }}
    >
      🗑️
    </div>

    <h3
      style={{
        fontSize: 19,
        fontWeight: 700,
        margin: '0 0 6px',
        overflowWrap: 'anywhere',
        lineHeight: 1.3,
      }}
    >
      Delete &ldquo;{name}&rdquo;?
    </h3>

    <p
      className="muted"
      style={{
        margin: '0 auto 22px',
        maxWidth: '100%',
        fontSize: 13.5,
        lineHeight: 1.5,
      }}
    >
      Are you sure you want to delete this medicine?
    </p>

    <div
      style={{
        display: 'flex',
        gap: 10,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <button
        type="button"
        className="btn"
        onClick={() => setConfirming(false)}
        disabled={busy}
        style={{
          flex: 1,
          minWidth: 0,
          boxSizing: 'border-box',
          background: '#F1F3F5',
          color: 'var(--text)',
          fontWeight: 600,
        }}
      >
        Cancel
      </button>
      <Button
        variant="danger"
        onClick={remove}
        loading={busy}
        style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', fontWeight: 600 }}
      >
        Delete
      </Button>
    </div>
  </div>
</Modal>
      </td>
    </tr>
  );
}

// Reusable category picker with an inline "add new category" flow.
function CategoryField({ value, onChange, categories, onReloadCategories }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    if (!newName.trim()) return setError('Enter a category name.');
    setBusy(true); setError('');
    try {
      const cat = await PharmacyApi.addCategory(newName.trim());
      await onReloadCategories();
      onChange(String(cat.id));
      setAdding(false); setNewName('');
    } catch (e) { setError(errMessage(e)); }
    finally { setBusy(false); }
  };

  if (adding) {
    return (
      <div className="field">
        <label>New category</label>
        {error && <div className="alert error" style={{ marginBottom: 8 }}>{error}</div>}
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Ayurvedic" autoFocus />
          <Button type="button" onClick={create} loading={busy}>Save</Button>
          <Button type="button" variant="ghost" onClick={() => { setAdding(false); setError(''); }}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="field">
      <label>Category</label>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">— No category —</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button type="button" variant="outline" onClick={() => setAdding(true)}>＋ New</Button>
      </div>
    </div>
  );
}

const FORMS = ['tablet', 'syrup', 'injection', 'capsule', 'drops', 'cream', 'other'];

function AddMedicine({ categories, onReloadCategories, onDone }) {
  const [form, setForm] = useState({
    custom_name: '', brand_name: '', composition: '', strength: '', form: 'tablet',
    category_id: '', price: '', mrp: '', quantity_available: '', prescription_required: false, stock_status: 'in_stock',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.custom_name || !form.price) return setError('Name and price are required.');
    if (!(Number(form.price) > 0)) return setError('Price must be greater than 0.');
    if (form.mrp && Number(form.mrp) < 0) return setError('MRP cannot be negative.');
    if (form.quantity_available && Number(form.quantity_available) < 0) return setError('Quantity cannot be negative.');
    setBusy(true); setError('');
    try {
      await PharmacyApi.addMedicine({
        custom_name: form.custom_name,
        brand_name: form.brand_name || undefined,
        composition: form.composition || undefined,
        strength: form.strength || undefined,
        form: form.form,
        category_id: form.category_id ? Number(form.category_id) : undefined,
        price: Number(form.price),
        mrp: form.mrp ? Number(form.mrp) : undefined,
        quantity_available: form.quantity_available ? Number(form.quantity_available) : undefined,
        prescription_required: form.prescription_required,
        stock_status: form.stock_status,
      });
      onDone();
    } catch (err) { setError(errMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit}>
      {error && <div className="alert error">{error}</div>}
      <Input label="Medicine name *" value={form.custom_name} onChange={(e) => set('custom_name', e.target.value)} placeholder="e.g. Paracetamol" />
      <div className="row">
        <Input label="Brand name" value={form.brand_name} onChange={(e) => set('brand_name', e.target.value)} placeholder="e.g. Calpol" />
        <Input label="Strength" value={form.strength} onChange={(e) => set('strength', e.target.value)} placeholder="e.g. 500mg" />
        <div className="field">
          <label>Form</label>
          <select className="select" value={form.form} onChange={(e) => set('form', e.target.value)}>
            {FORMS.map((f) => <option key={f} value={f}>{f[0].toUpperCase() + f.slice(1)}</option>)}
          </select>
        </div>
      </div>
      <Input label="Composition" value={form.composition} onChange={(e) => set('composition', e.target.value)} placeholder="e.g. Paracetamol 500mg" />
      <CategoryField value={form.category_id} onChange={(v) => set('category_id', v)} categories={categories} onReloadCategories={onReloadCategories} />
      <div className="row">
        <Input label="Price (₹) *" type="number" value={form.price} onChange={(e) => set('price', e.target.value)} />
        <Input label="MRP (₹)" type="number" value={form.mrp} onChange={(e) => set('mrp', e.target.value)} />
        <Input label="Quantity" type="number" value={form.quantity_available} onChange={(e) => set('quantity_available', e.target.value)} />
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

function EditMedicine({ m, categories, onReloadCategories, onDone }) {
  const [form, setForm] = useState({
    name: m.master_name || m.custom_name || '',
    brand_name: m.brand_name || '',
    composition: m.composition || '',
    strength: m.strength || '',
    form: m.form || 'tablet',
    price: String(m.price ?? ''),
    mrp: m.mrp != null ? String(m.mrp) : '',
    quantity_available: m.quantity_available != null ? String(m.quantity_available) : '',
    category_id: m.category_id ? String(m.category_id) : '',
    prescription_required: !!m.prescription_required,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price) return setError('Name and price are required.');
    if (!(Number(form.price) > 0)) return setError('Price must be greater than 0.');
    if (form.mrp && Number(form.mrp) < 0) return setError('MRP cannot be negative.');
    if (form.quantity_available && Number(form.quantity_available) < 0) return setError('Quantity cannot be negative.');
    setBusy(true); setError('');
    try {
      await PharmacyApi.updateMedicine(m.id, {
        name: form.name,
        brand_name: form.brand_name,
        composition: form.composition,
        strength: form.strength,
        form: form.form,
        price: Number(form.price),
        mrp: form.mrp ? Number(form.mrp) : null,
        quantity_available: form.quantity_available ? Number(form.quantity_available) : null,
        category_id: form.category_id ? Number(form.category_id) : null,
        prescription_required: form.prescription_required,
      });
      onDone();
    } catch (err) { setError(errMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit}>
      {error && <div className="alert error">{error}</div>}
      <Input label="Medicine name *" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Paracetamol" />
      <div className="row">
        <Input label="Brand name" value={form.brand_name} onChange={(e) => set('brand_name', e.target.value)} placeholder="e.g. Calpol" />
        <Input label="Strength" value={form.strength} onChange={(e) => set('strength', e.target.value)} placeholder="e.g. 500mg" />
        <div className="field">
          <label>Form</label>
          <select className="select" value={form.form} onChange={(e) => set('form', e.target.value)}>
            {FORMS.map((f) => <option key={f} value={f}>{f[0].toUpperCase() + f.slice(1)}</option>)}
          </select>
        </div>
      </div>
      <Input label="Composition" value={form.composition} onChange={(e) => set('composition', e.target.value)} placeholder="e.g. Paracetamol 500mg" />
      <CategoryField value={form.category_id} onChange={(v) => set('category_id', v)} categories={categories} onReloadCategories={onReloadCategories} />
      <div className="row">
        <Input label="Price (₹) *" type="number" value={form.price} onChange={(e) => set('price', e.target.value)} />
        <Input label="MRP (₹)" type="number" value={form.mrp} onChange={(e) => set('mrp', e.target.value)} />
        <Input label="Quantity" type="number" value={form.quantity_available} onChange={(e) => set('quantity_available', e.target.value)} />
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input type="checkbox" checked={form.prescription_required} onChange={(e) => set('prescription_required', e.target.checked)} />
        Prescription required
      </label>
      <Button type="submit" loading={busy} className="block">Save changes</Button>
    </form>
  );
}
