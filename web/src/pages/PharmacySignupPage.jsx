import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { AuthApi } from '../api';
import { errMessage } from '../api/client';
import { Input, Button } from '../components/UI';

export default function PharmacySignupPage() {
  const { saveSession } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ owner_name: '', mobile: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.owner_name || !form.mobile || !form.password) return setError('Please fill all required fields.');
    if (form.password.length < 6) return setError('Password must be at least 6 characters.');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const res = await AuthApi.registerPharmacy({
        owner_name: form.owner_name.trim(), mobile: form.mobile.trim(),
        email: form.email.trim() || undefined, password: form.password,
      });
      saveSession(res); // logs the new owner in
      navigate('/pharmacy/profile', { replace: true }); // next step: register pharmacy + upload docs
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <h1>List your pharmacy on NearDear</h1>
        <p>Create an account, add your pharmacy details and documents, and once our team approves you, start receiving medicine orders.</p>
        <div className="feat">
          <div>1️⃣ Create your owner account (with a password)</div>
          <div>2️⃣ Add pharmacy details & upload license</div>
          <div>3️⃣ Get approved by admin</div>
          <div>4️⃣ List medicines & manage orders</div>
        </div>
      </div>
      <div className="auth-form-side">
        <form className="auth-card card" onSubmit={submit}>
          <h2>Register your pharmacy</h2>
          <p className="subtitle" style={{ marginBottom: 18 }}>Step 1 of 2 — create your account.</p>
          {error && <div className="alert error">{error}</div>}
          <Input label="Owner name *" value={form.owner_name} onChange={(e) => set('owner_name', e.target.value)} />
          <Input label="Mobile number *" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} placeholder="10-digit mobile" />
          <Input label="Email (optional)" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          <div className="row">
            <Input label="Password *" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} />
            <Input label="Confirm *" type="password" value={form.confirm} onChange={(e) => set('confirm', e.target.value)} />
          </div>
          <Button type="submit" className="block" loading={loading}>Create account & continue</Button>
          <div className="divider" />
          <div style={{ textAlign: 'center' }} className="muted">
            Already registered? <Link to="/login">Sign in →</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
