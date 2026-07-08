import { Link } from 'react-router-dom';
import { AdminApi } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { Stat, Loader } from '../../components/UI';
import Icon from '../../components/Icon';

const si = (name, color) => <Icon name={name} size={26} color={color} />;

export default function AdminDashboard() {
  const { data, loading } = useAsync(() => AdminApi.dashboard());
  if (loading) return <Loader />;
  const d = data || {};

  return (
    <>
      <div className="grid cols-4">
        <Stat label="Users" value={d.users} icon={si('users', 'var(--primary)')} />
        <Stat label="Donors" value={d.donors} icon={si('blood', 'var(--blood)')} />
        <Stat label="Active blood requests" value={d.active_blood_requests} icon={si('sos', 'var(--danger)')} />
        <Stat label="Pending pharmacies" value={d.pending_pharmacies} icon={si('pharmacies', 'var(--pharmacy)')} />
      </div>
      <div className="grid cols-4" style={{ marginTop: 16 }}>
        <Stat label="Medicine orders" value={d.medicine_orders} icon={si('orders', 'var(--info)')} />
        <Stat label="Ambulance requests" value={d.ambulance_requests} icon={si('ambulance', 'var(--ambulance)')} />
        <Stat label="Open tickets" value={d.open_tickets} icon={si('support', 'var(--warning)')} />
        <div className="stat" style={{ display: 'flex', alignItems: 'center' }}>
          <Link to="/admin/pharmacies" className="btn block">Review pharmacies →</Link>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-title">Quick links</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn outline" to="/admin/pharmacies">Pharmacy approvals</Link>
          <Link className="btn outline" to="/admin/ambulance">Assign ambulances</Link>
          <Link className="btn outline" to="/admin/blood-requests">Blood requests</Link>
          <Link className="btn outline" to="/admin/support">Support tickets</Link>
        </div>
      </div>
    </>
  );
}
