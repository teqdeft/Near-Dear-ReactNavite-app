import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import NotificationBell from './NotificationBell';
import Icon from './Icon';

const NAV = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true },
    { to: '/admin/pharmacies', label: 'Pharmacy approvals', icon: 'pharmacies' },
    { to: '/admin/ambulance-vehicles', label: 'Ambulance Vehicles', icon: 'vehicles' },
    { to: '/admin/aadhaar', label: 'Aadhaar KYC', icon: 'documents' },
    { to: '/admin/users', label: 'Users', icon: 'users' },
    { to: '/admin/blood-requests', label: 'Blood requests', icon: 'blood' },
    { to: '/admin/donors', label: 'Donors', icon: 'blood' },
    { to: '/admin/ambulance', label: 'Ambulance', icon: 'ambulance' },
    { to: '/admin/orders', label: 'Medicine orders', icon: 'orders' },
    { to: '/admin/support', label: 'Support', icon: 'support' },
    { to: '/admin/notifications', label: 'Notifications', icon: 'bell' },
    { to: '/admin/audit', label: 'Audit logs', icon: 'audit' },
  ],
  pharmacy_owner: [
    { to: '/pharmacy', label: 'Dashboard', icon: 'dashboard', end: true },
    { to: '/pharmacy/medicines', label: 'Medicines', icon: 'medicines' },
    { to: '/pharmacy/orders', label: 'Orders', icon: 'orders' },
    { to: '/pharmacy/notifications', label: 'Notifications', icon: 'bell' },
    { to: '/pharmacy/profile', label: 'Profile & documents', icon: 'documents' },
  ],
};

const TITLES = {
  '/admin': 'Dashboard', '/admin/pharmacies': 'Pharmacy approvals', '/admin/ambulance-vehicles': 'Ambulance Vehicles', '/admin/aadhaar': 'Aadhaar KYC', '/admin/users': 'Users',
  '/admin/blood-requests': 'Blood requests', '/admin/donors': 'Donors', '/admin/ambulance': 'Ambulance', '/admin/orders': 'Medicine orders',
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

  // Browser-tab title depends on which panel the logged-in user is in.
  useEffect(() => {
    document.title = role === 'admin' ? 'Near dear Admin' : 'Pharmacy Panel';
  }, [role]);

  // Mobile navigation drawer. Closed by default; the topbar hamburger opens it,
  // and any navigation or overlay tap closes it again.
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => { setNavOpen(false); }, [loc.pathname]);

  return (
    <div className="app-shell">
      <aside className={'sidebar' + (navOpen ? ' open' : '')}>
        <div className="brand">
          <Icon name="brand" size={22} /> NearDear
          <span className="role-chip">{role === 'admin' ? 'Admin' : 'Pharmacy'}</span>
        </div>
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end}
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            <Icon name={it.icon} size={19} className="ico" />{it.label}
          </NavLink>
        ))}
      </aside>
      {navOpen && <div className="nav-overlay" onClick={() => setNavOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="nav-toggle" aria-label="Toggle menu" onClick={() => setNavOpen((v) => !v)}>
            <Icon name="menu" size={22} />
          </button>
          <div className="page-title">{title}</div>
          <div className="spacer" />
          <div className="user">
            <NotificationBell base={base} />
            <span className="user-name" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="user" size={18} /> {user?.name || user?.mobile}
            </span>
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
