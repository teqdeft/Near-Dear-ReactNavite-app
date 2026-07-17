import { useState, useEffect, useMemo } from 'react';
import { AdminApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Button, Badge, Loader, ErrorState, Pagination, money } from '../../components/UI';
import { formatDateTime } from '../../utils/datetime';
import { normalize, bestScore } from '../../utils/search';

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
  const [search, setSearch] = useState('');
  const rows = data || [];
  const pick = (p) => onPick({ id: p.id, name: p.pharmacy_name });

  // Live, typo-tolerant filter over pharmacy / owner / mobile / city.
  const filtered = useMemo(() => {
    const queryNorm = normalize(search);
    if (!queryNorm) return rows;
    return rows
      .map((p) => ({ p, score: bestScore(queryNorm, [p.pharmacy_name, p.owner_name, p.mobile, p.city, ...String(p.pharmacy_name || '').split(/\s+/)]) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.p.id - a.p.id)
      .map((x) => x.p);
  }, [rows, search]);

  return (
    <>
      <div className="toolbar">
        <div className="section-title" style={{ margin: 0 }}>Select a pharmacy to view its orders</div>
        <div className="spacer" />
        <input className="input" type="search" style={{ maxWidth: 260 }} placeholder="Search pharmacy, owner, city…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="card" style={{ padding: 0 }}>
        {loading ? <Loader /> : error ? <ErrorState message={errMessage(error)} onRetry={reload} /> : (
          <table className="table">
            <thead><tr><th>Pharmacy</th><th>City</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={4} className="muted" style={{ padding: 24 }}>No pharmacies registered yet.</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="muted" style={{ padding: 24 }}>No pharmacies match “{search}”.</td></tr>
              ) : filtered.map((p) => (
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
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState(''); // debounced value actually sent to the API

  // Server-side search (order number / customer name / mobile), same filter the
  // pharmacy panel uses. Debounced so typing doesn't fire a request per keystroke,
  // and any new search jumps back to page 1.
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, loading, error, reload } = useAsync(
    () => AdminApi.orders({ pharmacy_id: pharmacy.id, search: query || undefined, page, limit: PAGE_SIZE }),
    [query, page],
  );
  const rows = data?.items || [];

  return (
    <>
      <div className="toolbar">
        <Button variant="ghost" onClick={onBack}>← All pharmacies</Button>
        <div className="spacer" />
        <input className="input" type="search" style={{ maxWidth: 260 }} placeholder="Search order no, customer, mobile…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="section-title" style={{ marginBottom: 12 }}>
        Orders — {pharmacy.name}
        {data?.total != null && <span className="muted" style={{ fontWeight: 400 }}> ({data.total} order{data.total === 1 ? '' : 's'})</span>}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? <Loader /> : error ? <ErrorState message={errMessage(error)} onRetry={reload} /> : (
          <table className="table">
            <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Payment</th><th>Total</th><th>Placed</th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="muted" style={{ padding: 24 }}>
                  {query ? `No orders match “${query}”.` : 'No orders for this pharmacy yet.'}
                </td></tr>
              ) : rows.map((o) => (
                <tr key={o.id}>
                  <td><b>{o.order_number}</b></td>
                  <td>{o.customer_name || '—'}<div className="muted">{o.customer_mobile}</div></td>
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
