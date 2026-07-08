import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell,
} from 'recharts';
import { PharmacyApi } from '../../api';
import { errMessage } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { Loader, Badge, ErrorState, money } from '../../components/UI';
import Icon from '../../components/Icon';

// KPI badge icon — colour is inherited from the tile's `ink` colour.
const ki = (name) => <Icon name={name} size={22} />;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayLabel = (iso) => DAY_LABELS[new Date(`${iso}T00:00:00`).getDay()];

const PRIMARY = '#0E9F8E';
const PHARMA = '#2F9E44';

// A modern KPI tile with a soft coloured icon badge. Pass `to` to make the
// whole tile a clickable link (e.g. deep-link into a filtered orders list).
function Kpi({ label, value, icon, tint, ink, to }) {
  const content = (
    <>
      <div style={{ width: 46, height: 46, borderRadius: 12, background: tint, color: ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>{value}</div>
        <div className="muted" style={{ fontSize: 13 }}>{label}</div>
      </div>
    </>
  );
  const baseStyle = { display: 'flex', alignItems: 'center', gap: 14 };
  if (to) {
    return (
      <Link to={to} className="card" style={{ ...baseStyle, textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
        {content}
      </Link>
    );
  }
  return <div className="card" style={baseStyle}>{content}</div>;
}

function ChartTooltip({ active, payload, label, prefix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', boxShadow: '0 6px 20px rgba(0,0,0,.1)' }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, color: 'var(--text)' }}>{prefix}{payload[0].value}</div>
    </div>
  );
}

export default function PharmacyDashboard() {
  const { data, loading, error, reload } = useAsync(() => PharmacyApi.dashboard());
  const { data: sales } = useAsync(() => PharmacyApi.sales());

  if (loading) return <Loader />;
  if (error) {
    if (error?.response?.status === 404) {
      return (
        <div className="card">
          <h3>Welcome to your pharmacy panel</h3>
          <p className="muted" style={{ marginTop: 8 }}>
            You haven't registered your pharmacy yet. Head to{' '}
            <Link to="/pharmacy/profile">Profile & documents</Link> to add your details and upload your license.
          </p>
        </div>
      );
    }
    return <ErrorState message={errMessage(error)} onRetry={reload} />;
  }

  const o = data.orders;
  const daily = (sales?.daily || []).map((d) => ({ ...d, label: dayLabel(d.day) }));
  const top = sales?.top_medicines || [];

  return (
    <>
      <div className="card" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20 }}>{data.pharmacy.name}</h2>
          <div className="muted">Approval status</div>
        </div>
        <Badge value={data.pharmacy.approval_status} />
      </div>

      {sales?.low_stock_count > 0 && (
        <Link to="/pharmacy/medicines" className="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFF4E5', color: '#8A5300', marginBottom: 16, textDecoration: 'none' }}>
          <Icon name="warning" size={18} style={{ flexShrink: 0 }} />
          <span><b>{sales.low_stock_count}</b> medicine{sales.low_stock_count > 1 ? 's are' : ' is'} low on stock — review your listings →</span>
        </Link>
      )}

      {/* Revenue KPIs */}
      {sales && (
        <div className="grid cols-4">
          <Kpi label="Total revenue" value={money(sales.total_revenue)} icon={ki('revenue')} tint="#E6F7F4" ink={PRIMARY} to="/pharmacy/orders?status=delivered" />
          <Kpi label="Today's revenue" value={money(sales.today_revenue)} icon={ki('trending')} tint="#E7F6EC" ink={PHARMA} to="/pharmacy/orders?status=delivered" />
          <Kpi label="Delivered orders" value={sales.orders.delivered} icon={ki('package')} tint="#EAF1FE" ink="#2B6CB0" to="/pharmacy/orders?status=delivered" />
          <Kpi label="Low stock" value={sales.low_stock_count} icon={ki('warning')} tint="#FFF4E5" ink="#B7791F" to="/pharmacy/medicines" />
        </div>
      )}

      {/* Charts */}
      {sales && (
        <div className="grid cols-2" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="section-title">Revenue — last 7 days</div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={daily} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={PRIMARY} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#EEF1F4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#8A94A6', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} width={48} tick={{ fill: '#8A94A6', fontSize: 12 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip content={<ChartTooltip prefix="₹" />} cursor={{ stroke: PRIMARY, strokeDasharray: 4 }} />
                <Area type="monotone" dataKey="revenue" stroke={PRIMARY} strokeWidth={2.5} fill="url(#rev)" dot={{ r: 3, fill: PRIMARY }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="section-title">Top selling medicines</div>
            {top.length === 0 ? (
              <p className="muted">No sales yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={top} layout="vertical" margin={{ top: 6, right: 16, left: 8, bottom: 0 }} barCategoryGap={12}>
                  <CartesianGrid horizontal={false} stroke="#EEF1F4" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: '#8A94A6', fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={90} tickLine={false} axisLine={false} tick={{ fill: 'var(--text)', fontSize: 12 }} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(47,158,68,.06)' }} />
                  <Bar dataKey="qty" radius={[0, 6, 6, 0]} barSize={16}>
                    {top.map((m, i) => <Cell key={m.name} fill={PHARMA} fillOpacity={1 - i * 0.13} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Order status breakdown */}
      <div className="section-title" style={{ marginTop: 20 }}>Orders</div>
      <div className="grid cols-4">
        <Kpi label="Total orders" value={o.total} icon={ki('orders')} tint="#F1F3F5" ink="#495057" to="/pharmacy/orders" />
        <Kpi label="New (placed)" value={o.placed} icon={ki('new')} tint="#EAF1FE" ink="#2B6CB0" to="/pharmacy/orders?status=placed" />
        <Kpi label="Accepted" value={o.accepted} icon={ki('accepted')} tint="#E7F6EC" ink={PHARMA} to="/pharmacy/orders?status=accepted" />
        <Kpi label="Delivered" value={o.delivered} icon={ki('delivered')} tint="#E6F7F4" ink={PRIMARY} to="/pharmacy/orders?status=delivered" />
      </div>
      <div className="grid cols-4" style={{ marginTop: 16 }}>
        <Kpi label="Preparing" value={o.preparing} icon={ki('preparing')} tint="#FFF4E5" ink="#B7791F" to="/pharmacy/orders?status=preparing" />
        <Kpi label="Out for delivery" value={o.out_for_delivery} icon={ki('vehicles')} tint="#FFF4E5" ink="#B7791F" to="/pharmacy/orders?status=out_for_delivery" />
        <Kpi label="Rejected" value={o.rejected} icon={ki('rejected')} tint="#FDECEC" ink="#D64545" to="/pharmacy/orders?status=rejected" />
        <div className="card" style={{ display: 'flex', alignItems: 'center' }}>
          <Link to="/pharmacy/orders" className="btn block">View all orders →</Link>
        </div>
      </div>
    </>
  );
}
