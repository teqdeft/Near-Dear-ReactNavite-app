import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import NotificationBell from './NotificationBell';

const NAV = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: '📊', end: true },
    { to: '/admin/pharmacies', label: 'Pharmacy approvals', icon: '🏪' },
    { to: '/admin/ambulance-vehicles', label: 'Ambulance Vehicles', icon: '🚐' },
    { to: '/admin/users', label: 'Users', icon: '👥' },
    { to: '/admin/blood-requests', label: 'Blood requests', icon: '🩸' },
    { to: '/admin/ambulance', label: 'Ambulance', icon: '🚑' },
    { to: '/admin/orders', label: 'Medicine orders', icon: '🧾' },
    { to: '/admin/support', label: 'Support', icon: '💬' },
    { to: '/admin/notifications', label: 'Notifications', icon: '🔔' },
    { to: '/admin/audit', label: 'Audit logs', icon: '🛡️' },
  ],
  pharmacy_owner: [
    { to: '/pharmacy', label: 'Dashboard', icon: '📊', end: true },
    { to: '/pharmacy/medicines', label: 'Medicines', icon: '💊' },
    { to: '/pharmacy/orders', label: 'Orders', icon: '🧾' },
    { to: '/pharmacy/notifications', label: 'Notifications', icon: '🔔' },
    { to: '/pharmacy/profile', label: 'Profile & documents', icon: '📄' },
  ],
};

const TITLES = {
  '/admin': 'Dashboard', '/admin/pharmacies': 'Pharmacy approvals', '/admin/ambulance-vehicles': 'Ambulance Vehicles', '/admin/users': 'Users',
  '/admin/blood-requests': 'Blood requests', '/admin/ambulance': 'Ambulance', '/admin/orders': 'Medicine orders',
  '/admin/support': 'Support', '/admin/audit': 'Audit logs', '/admin/notifications': 'Notifications',
  '/pharmacy': 'Dashboard', '/pharmacy/medicines': 'Medicines', '/pharmacy/orders': 'Orders', '/pharmacy/profile': 'Profile & documents',
  '/pharmacy/notifications': 'Notifications',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const role = user?.role === 'admin' ? 'admin' : 'pharmacy_owner';
  const items = NAV[role] || [];
  const title = TITLES[loc.pathname] || 'NearDear';
  const base = role === 'admin' ? '/admin' : '/pharmacy';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          ❤️ NearDear
          <span className="role-chip">{role === 'admin' ? 'Admin' : 'Pharmacy'}</span>
        </div>
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end}
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            <span className="ico">{it.icon}</span> {it.label}
          </NavLink>
        ))}
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="page-title">{title}</div>
          <div className="spacer" />
          <div className="user">
            <NotificationBell base={base} />
            <span>👤 {user?.name || user?.mobile}</span>
            <button className="btn ghost sm" onClick={logout}>Log out</button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
