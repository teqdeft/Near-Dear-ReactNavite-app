import { Link } from 'react-router-dom';
import { PharmacyApi } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { Stat, Loader, Badge } from '../../components/UI';

export default function PharmacyDashboard() {
  const { data, loading, error } = useAsync(() => PharmacyApi.dashboard());

  if (loading) return <Loader />;
  if (error) {
    // Most likely: no pharmacy registered yet.
    return (
      <div className="card">
        <h3>Welcome to your pharmacy panel 👋</h3>
        <p className="muted" style={{ marginTop: 8 }}>
          You haven't registered your pharmacy yet. Head to{' '}
          <Link to="/pharmacy/profile">Profile & documents</Link> to add your details and upload your license.
        </p>
      </div>
    );
  }

  const o = data.orders;
  return (
    <>
      <div className="card" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20 }}>{data.pharmacy.name}</h2>
          <div className="muted">Approval status</div>
        </div>
        <Badge value={data.pharmacy.approval_status} />
      </div>

      <div className="grid cols-4">
        <Stat label="Total orders" value={o.total} icon="🧾" />
        <Stat label="New (placed)" value={o.placed} icon="🆕" />
        <Stat label="Accepted" value={o.accepted} icon="✅" />
        <Stat label="Delivered" value={o.delivered} icon="📦" />
      </div>
      <div className="grid cols-4" style={{ marginTop: 16 }}>
        <Stat label="Preparing" value={o.preparing} icon="👨‍🍳" />
        <Stat label="Out for delivery" value={o.out_for_delivery} icon="🚚" />
        <Stat label="Rejected" value={o.rejected} icon="🚫" />
        <div className="stat" style={{ display: 'flex', alignItems: 'center' }}>
          <Link to="/pharmacy/orders" className="btn block">View all orders →</Link>
        </div>
      </div>
    </>
  );
}
