import { useState, useEffect } from 'react';
import { PharmacyApi } from '../../api';
import { fetchFileObjectUrl, errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Button, Badge, Loader, Modal, money, ErrorState, ReasonModal } from '../../components/UI';

const NEXT_ACTIONS = {
  placed: [{ to: 'accepted', label: 'Accept', variant: 'success' }, { to: 'rejected', label: 'Reject', variant: 'danger' }],
  accepted: [{ to: 'preparing', label: 'Start preparing', variant: '' }],
  preparing: [{ to: 'out_for_delivery', label: 'Out for delivery', variant: '' }],
  out_for_delivery: [{ to: 'delivered', label: 'Mark delivered', variant: 'success' }],
};

export default function PharmacyOrders() {
  const { data, loading, error, reload } = useAsync(() => PharmacyApi.orders());
  const [detail, setDetail] = useState(null);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;
  const rows = data || [];

  return (
    <>
      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Payment</th><th>Total</th><th>Placed</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="muted" style={{ padding: 24 }}>No orders yet.</td></tr>
            ) : rows.map((o) => (
              <tr key={o.id}>
                <td><b>{o.order_number}</b></td>
                <td>{o.customer_name || '—'}<div className="muted">{o.customer_mobile}</div></td>
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
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState('');

  // Free the blob URL created for the prescription preview on unmount.
  useEffect(() => () => { if (rxUrl) URL.revokeObjectURL(rxUrl); }, [rxUrl]);

  if (loading) return <Loader />;
  const { order, items, prescription, address } = data;

  const applyStatus = async (status, reason) => {
    setBusy(true); setError('');
    try {
      await PharmacyApi.updateOrderStatus(id, status, reason);
      setRejecting(false);
      await reload();
      onChanged();
    } catch (e) { setError(errMessage(e)); }
    finally { setBusy(false); }
  };
  const onAction = (status) => {
    if (status === 'rejected') setRejecting(true);
    else applyStatus(status);
  };

  const reviewPrescription = async (status) => {
    setBusy(true); setError('');
    try {
      await PharmacyApi.reviewPrescription(prescription.id, status);
      await reload();
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
      <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
        {order.payment_method?.toUpperCase()} • Placed {String(order.created_at || '').slice(0, 16).replace('T', ' ')}
      </div>

      <div className="card" style={{ marginTop: 12, background: '#FAFBFC' }}>
        <div className="section-title" style={{ margin: '0 0 6px' }}>Customer & delivery</div>
        <div><b>{order.customer_name || 'Customer'}</b>{order.customer_mobile ? <span className="muted"> • 📞 {order.customer_mobile}</span> : ''}</div>
        {address ? (
          <div className="muted" style={{ marginTop: 4, lineHeight: 1.5 }}>
            {address.name ? <span>{address.name}<br /></span> : ''}
            {address.address_line_1}{address.address_line_2 ? `, ${address.address_line_2}` : ''}<br />
            {[address.city, address.state, address.pincode].filter(Boolean).join(', ')}
          </div>
        ) : (
          <div className="muted" style={{ marginTop: 4 }}>No delivery address provided.</div>
        )}
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
            <span>📄 {(prescription.patient_name_snapshot || order.customer_name) ? `${prescription.patient_name_snapshot || order.customer_name}'s prescription` : 'Prescription'} <Badge value={prescription.status} /></span>
            <Button size="sm" variant="outline" onClick={viewPrescription}>View</Button>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>Rx #{prescription.id}{(prescription.patient_mobile_snapshot || order.customer_mobile) ? ` • 📞 ${prescription.patient_mobile_snapshot || order.customer_mobile}` : ''}</div>
          {rxUrl && <img src={rxUrl} alt="prescription" style={{ width: '100%', marginTop: 12, borderRadius: 8 }} />}
          {['uploaded', 'under_review'].includes(prescription.status) && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Button size="sm" variant="success" loading={busy} onClick={() => reviewPrescription('approved')}>Approve Rx</Button>
              <Button size="sm" variant="danger" loading={busy} onClick={() => reviewPrescription('rejected')}>Reject Rx</Button>
            </div>
          )}
        </div>
      )}

      <div className="divider" />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {actions.length === 0 ? <span className="muted">No further actions for this order.</span> :
          actions.map((a) => (
            <Button key={a.to} variant={a.variant} loading={busy} onClick={() => onAction(a.to)}>{a.label}</Button>
          ))}
        <div style={{ flex: 1 }} />
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>

      <ReasonModal
        open={rejecting}
        title="Reject order"
        label="Reason for rejection"
        placeholder="e.g. Item out of stock, address unreachable…"
        confirmLabel="Reject order"
        loading={busy}
        onConfirm={(reason) => applyStatus('rejected', reason)}
        onClose={() => setRejecting(false)}
      />
    </div>
  );
}
