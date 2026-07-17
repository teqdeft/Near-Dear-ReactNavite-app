import { useState } from 'react';
import { AdminApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Button, Badge, Loader, ErrorState, Pagination, money } from '../../components/UI';
import { formatDateTime } from '../../utils/datetime';

const PAGE_SIZE = 20;

// Two-level view: the admin first picks a pharmacy, then sees only that
// pharmacy's orders. A single flat list mixes every pharmacy's orders together,
// which stops being readable the moment more than one pharmacy onboards.
export default function AdminOrders() {
  const [selected, setSelected] = useState(null); // { id, name } | null
  if (!selected) return <PharmacyPicker onPick={setSelected} />;
  return <PharmacyOrders pharmacy={selected} onBack={() => setSelected(null)} />;
}

function PharmacyPicker({ onPick }) {
  const { data, loading, error, reload } = useAsync(() => AdminApi.pharmacies(), []);
  const rows = data || [];
  const pick = (p) => onPick({ id: p.id, name: p.pharmacy_name });

  return (
    <>
      <div className="section-title" style={{ marginBottom: 12 }}>Select a pharmacy to view its orders</div>
      <div className="card" style={{ padding: 0 }}>
        {loading ? <Loader /> : error ? <ErrorState message={errMessage(error)} onRetry={reload} /> : (
          <table className="table">
            <thead><tr><th>Pharmacy</th><th>City</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={4} className="muted" style={{ padding: 24 }}>No pharmacies registered yet.</td></tr>
              ) : rows.map((p) => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => pick(p)}>
                  <td><b>{p.pharmacy_name}</b><div className="muted">{p.owner_name} • {p.mobile}</div></td>
                  <td className="muted">{p.city}</td>
                  <td><Badge value={p.approval_status} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); pick(p); }}>View orders →</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function PharmacyOrders({ pharmacy, onBack }) {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(
    () => AdminApi.orders({ pharmacy_id: pharmacy.id, page, limit: PAGE_SIZE }),
    [page],
  );
  const rows = data?.items || [];

  return (
    <>
      <div className="toolbar">
        <Button variant="ghost" onClick={onBack}>← All pharmacies</Button>
        <div className="spacer" />
      </div>
      <div className="section-title" style={{ marginBottom: 12 }}>
        Orders — {pharmacy.name}
        {data?.total != null && <span className="muted" style={{ fontWeight: 400 }}> ({data.total} order{data.total === 1 ? '' : 's'})</span>}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? <Loader /> : error ? <ErrorState message={errMessage(error)} onRetry={reload} /> : (
          <table className="table">
            <thead><tr><th>Order</th><th>Status</th><th>Payment</th><th>Total</th><th>Placed</th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="muted" style={{ padding: 24 }}>No orders for this pharmacy yet.</td></tr>
              ) : rows.map((o) => (
                <tr key={o.id}>
                  <td><b>{o.order_number}</b></td>
                  <td><Badge value={o.order_status} /></td>
                  <td className="muted">{o.payment_method?.toUpperCase()}</td>
                  <td>{money(o.total_amount)}</td>
                  <td className="muted">{formatDateTime(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination page={data?.page || page} limit={data?.limit || PAGE_SIZE} total={data?.total || 0} onPage={setPage} />
    </>
  );
}
