import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './store/AuthContext';
import { Loader } from './components/UI';
import Layout from './components/Layout';

import LoginPage from './pages/LoginPage';
import PharmacySignupPage from './pages/PharmacySignupPage';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminPharmacies from './pages/admin/AdminPharmacies';
import AdminUsers from './pages/admin/AdminUsers';
import AdminBloodRequests from './pages/admin/AdminBloodRequests';
import AdminAmbulance from './pages/admin/AdminAmbulance';
import AdminOrders from './pages/admin/AdminOrders';
import AdminSupport from './pages/admin/AdminSupport';
import AdminAudit from './pages/admin/AdminAudit';

import PharmacyDashboard from './pages/pharmacy/PharmacyDashboard';
import PharmacyMedicines from './pages/pharmacy/PharmacyMedicines';
import PharmacyOrders from './pages/pharmacy/PharmacyOrders';
import PharmacyProfile from './pages/pharmacy/PharmacyProfile';

function homeFor(user) {
  return user?.role === 'admin' ? '/admin' : '/pharmacy';
}

function Require({ roles, children }) {
  const { booting, user } = useAuth();
  const loc = useLocation();
  if (booting) return <Loader text="Loading NearDear panel…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return children;
}

function PublicOnly({ children }) {
  const { booting, user } = useAuth();
  if (booting) return <Loader text="Loading…" />;
  if (user) return <Navigate to={homeFor(user)} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><PharmacySignupPage /></PublicOnly>} />

      {/* Admin */}
      <Route element={<Require roles={['admin']}><Layout /></Require>}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/pharmacies" element={<AdminPharmacies />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/blood-requests" element={<AdminBloodRequests />} />
        <Route path="/admin/ambulance" element={<AdminAmbulance />} />
        <Route path="/admin/orders" element={<AdminOrders />} />
        <Route path="/admin/support" element={<AdminSupport />} />
        <Route path="/admin/audit" element={<AdminAudit />} />
      </Route>

      {/* Pharmacy */}
      <Route element={<Require roles={['pharmacy_owner', 'pharmacy_staff']}><Layout /></Require>}>
        <Route path="/pharmacy" element={<PharmacyDashboard />} />
        <Route path="/pharmacy/medicines" element={<PharmacyMedicines />} />
        <Route path="/pharmacy/orders" element={<PharmacyOrders />} />
        <Route path="/pharmacy/profile" element={<PharmacyProfile />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
