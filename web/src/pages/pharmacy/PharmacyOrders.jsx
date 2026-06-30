import { useState } from 'react';
import { PharmacyApi } from '../../api';
import { fetchFileObjectUrl, errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Button, Badge, Loader, Modal, money } from '../../components/UI';

const NEXT_ACTIONS = {
  placed: [{ to: 'accepted', label: 'Accept', variant: 'success' }, { to: 'rejected', label: 'Reject', variant: 'danger' }],
  accepted: [{ to: 'preparing', label: 'Start preparing', variant: '' }],
  preparing: [{ to: 'out_for_delivery', label: 'Out for delivery', variant: '' }],
  out_for_delivery: [{ to: 'delivered', label: 'Mark delivered', variant: 'success' }],
};

export default function PharmacyOrders() {
  const { data, loading, reload } = useAsync(() => PharmacyApi.orders());
  const [detail, setDetail] = useState(null);

  if (loading) return <Loader />;
  const rows = data || [];

  return (
    <>
      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th>Order</th><th>Status</th><th>Payment</th><th>Total</th><th>Placed</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="muted" style={{ padding: 24 }}>No orders yet.</td></tr>
            ) : rows.map((o) => (
              <tr key={o.id}>
                <td><b>{o.order_number}</b></td>
                <td><Badge value={o.order_status} /></td>
                <td className="muted">{o.payment_method?.toUpperCase()}</td>
                <td>{money(o.total_amount)}</td>
                <td className="muted">{String(o.created_at || '').slice(0, 16).replace('T', ' ')}</td>
                <td><Button size="sm" variant="outline" onClick={() => setDetail(o.id)}>Manage</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Order details" width={620}>
        {detail && <OrderDetail id={detail} onChanged={() => { reload(); }} onClose={() => setDetail(null)} />}
      </Modal>
    </>
  );
}

function OrderDetail({ id, onChanged, onClose }) {
  const { data, loading, reload } = useAsync(() => PharmacyApi.orderDetail(id), [id]);
  const [busy, setBusy] = useState(false);
  const [rxUrl, setRxUrl] = useState(null);
  const [error, setError] = useState('');

  if (loading) return <Loader />;
  const { order, items, prescription } = data;

  const setStatus = async (status) => {
    let reason;
    if (status === 'rejected') {
      reason = window.prompt('Reason for rejection?') || 'Rejected by pharmacy';
    }
    setBusy(true); setError('');
    try {
      await PharmacyApi.updateOrderStatus(id, status, reason);
      await reload();
      onChanged();
    } catch (e) { setError(errMessage(e)); }
    finally { setBusy(false); }
  };

  const viewPrescription = async () => {
    try { setRxUrl(await fetchFileObjectUrl(prescription.url)); }
    catch (e) { setError(errMessage(e)); }
  };

  const actions = NEXT_ACTIONS[order.order_status] || [];

  return (
    <div>
      {error && <div className="alert error">{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <b>{order.order_number}</b>
        <Badge value={order.order_status} />
      </div>
      <div className="divider" />
      <table className="table">
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td>{it.medicine_name_snapshot} <span className="muted">× {it.quantity}</span></td>
              <td style={{ textAlign: 'right' }}>{money(it.total_price)}</td>
            </tr>
          ))}
          <tr><td><b>Total</b></td><td style={{ textAlign: 'right' }}><b>{money(order.total_amount)}</b></td></tr>
        </tbody>
      </table>

      {prescription && (
        <div className="card" style={{ marginTop: 12, background: '#FAFBFC' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>📄 Prescription attached <Badge value={prescription.status} /></span>
            <Button size="sm" variant="outline" onClick={viewPrescription}>View</Button>
          </div>
          {rxUrl && <img src={rxUrl} alt="prescription" style={{ width: '100%', marginTop: 12, borderRadius: 8 }} />}
        </div>
      )}

      <div className="divider" />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {actions.length === 0 ? <span className="muted">No further actions for this order.</span> :
          actions.map((a) => (
            <Button key={a.to} variant={a.variant} loading={busy} onClick={() => setStatus(a.to)}>{a.label}</Button>
          ))}
        <div style={{ flex: 1 }} />
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}
