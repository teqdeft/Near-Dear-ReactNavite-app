import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { errMessage } from '../api/client';
import { Input, Button } from '../components/UI';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(mobile.trim(), password);
      navigate(user.role === 'admin' ? '/admin' : '/pharmacy', { replace: true });
    } catch (err) {
      setError(errMessage(err, 'Invalid credentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <h1>NearDear</h1>
        <p>Admin & Pharmacy control center for blood donation, ambulance and medicine operations.</p>
        <div className="feat">
          <div>🏪 Approve pharmacies & review documents</div>
          <div>💊 Manage medicines, prescriptions & orders</div>
          <div>🚑 Assign ambulances & track requests</div>
          <div>🩸 Monitor blood requests & donor matches</div>
        </div>
      </div>
      <div className="auth-form-side">
        <form className="auth-card card" onSubmit={submit}>
          <h2>Sign in</h2>
          <p className="subtitle" style={{ marginBottom: 18 }}>Admin, pharmacy & driver accounts.</p>
          {error && <div className="alert error">{error}</div>}
          <Input label="Mobile number" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="9999900001" />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          <Button type="submit" className="block" loading={loading}>Sign in</Button>

          <div className="divider" />
          <div style={{ textAlign: 'center' }} className="muted">
            Are you a pharmacy? <Link to="/signup">Register your pharmacy →</Link>
          </div>
          <div className="alert info" style={{ marginTop: 16 }}>
            <b>Demo admin:</b> 9999900001 / Admin@123<br />
            <b>Demo pharmacy:</b> 9999900002 / Pharma@123
          </div>
        </form>
      </div>
    </div>
  );
}
