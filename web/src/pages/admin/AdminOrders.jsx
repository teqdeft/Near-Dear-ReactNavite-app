import { useState } from 'react';
import { AdminApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Badge, Loader, ErrorState, Pagination, money } from '../../components/UI';

const PAGE_SIZE = 20;

export default function AdminOrders() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => AdminApi.orders({ page, limit: PAGE_SIZE }), [page]);
  const rows = data?.items || [];

  return (
    <>
      <div className="card" style={{ padding: 0 }}>
        {loading ? <Loader /> : error ? <ErrorState message={errMessage(error)} onRetry={reload} /> : (
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
        )}
      </div>

      <Pagination page={data?.page || page} limit={data?.limit || PAGE_SIZE} total={data?.total || 0} onPage={setPage} />
    </>
  );
}
