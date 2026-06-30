import { AdminApi } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { Badge, Loader, money } from '../../components/UI';

export default function AdminOrders() {
  const { data, loading } = useAsync(() => AdminApi.orders());
  if (loading) return <Loader />;
  const rows = data || [];

  return (
    <div className="card" style={{ padding: 0 }}>
      <table className="table">
        <thead><tr><th>Order</th><th>Pharmacy</th><th>Status</th><th>Payment</th><th>Total</th><th>Placed</th></tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={6} className="muted" style={{ padding: 24 }}>No orders.</td></tr>
          ) : rows.map((o) => (
            <tr key={o.id}>
              <td><b>{o.order_number}</b></td>
              <td>{o.pharmacy_name}</td>
              <td><Badge value={o.order_status} /></td>
              <td className="muted">{o.payment_method?.toUpperCase()}</td>
              <td>{money(o.total_amount)}</td>
              <td className="muted">{String(o.created_at || '').slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
