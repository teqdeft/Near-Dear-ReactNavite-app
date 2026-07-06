import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { AuthApi } from '../api';
import { errMessage } from '../api/client';
import { Input, Button, Modal } from '../components/UI';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);

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

          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button type="button" className="linklike" onClick={() => setForgot(true)}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}>
              Forgot password?
            </button>
          </div>

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

      <Modal open={forgot} onClose={() => setForgot(false)} title="Reset your password" width={420}>
        <ForgotPassword onClose={() => setForgot(false)} />
      </Modal>
    </div>
  );
}

function ForgotPassword({ onClose }) {
  const [step, setStep] = useState(1);
  const [fmobile, setFmobile] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const requestOtp = async (e) => {
    e.preventDefault();
    if (!fmobile.trim()) return setError('Enter your registered mobile number.');
    setBusy(true); setError('');
    try {
      const res = await AuthApi.forgotPasswordRequestOtp(fmobile.trim());
      setDevCode(res?.data?.devCode || '');
      setStep(2);
    } catch (err) { setError(errMessage(err)); }
    finally { setBusy(false); }
  };

  const reset = async (e) => {
    e.preventDefault();
    if (code.length < 6) return setError('Enter the 6-digit OTP.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true); setError('');
    try {
      await AuthApi.forgotPasswordReset(fmobile.trim(), code, password);
      alert('Password reset. Please sign in with your new password.');
      onClose();
    } catch (err) { setError(errMessage(err)); }
    finally { setBusy(false); }
  };

  if (step === 1) {
    return (
      <form onSubmit={requestOtp}>
        {error && <div className="alert error">{error}</div>}
        <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>We’ll send an OTP to your registered mobile number.</p>
        <Input label="Registered mobile" value={fmobile} onChange={(e) => setFmobile(e.target.value)} placeholder="9999900002" />
        <Button type="submit" className="block" loading={busy}>Send OTP</Button>
      </form>
    );
  }

  return (
    <form onSubmit={reset}>
      {error && <div className="alert error">{error}</div>}
      <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
        OTP sent to {fmobile}{devCode ? `  (dev code: ${devCode})` : ''}
      </p>
      <Input label="OTP code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" />
      <Input label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      <Input label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
      <Button type="submit" className="block" loading={busy}>Reset password</Button>
    </form>
  );
}
