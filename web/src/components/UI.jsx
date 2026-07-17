import { useEffect, useState } from 'react';
import Icon from './Icon';

export function Field({ label, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
    </div>
  );
}

export function Input({ label, ...props }) {
  const [reveal, setReveal] = useState(false);

  // Password fields get a show/hide eye toggle. Any other input renders as-is.
  if (props.type === 'password') {
    return (
      <Field label={label}>
        <div style={{ position: 'relative' }}>
          <input {...props} type={reveal ? 'text' : 'password'} className="input" style={{ ...props.style, paddingRight: 42 }} />
          <button type="button" onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? 'Hide password' : 'Show password'} tabIndex={-1}
            style={{ position: 'absolute', top: 0, right: 0, height: '100%', width: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            <Icon name={reveal ? 'eyeOff' : 'eye'} size={18} />
          </button>
        </div>
      </Field>
    );
  }

  return (
    <Field label={label}>
      <input className="input" {...props} />
    </Field>
  );
}

export function Select({ label, children, ...props }) {
  return (
    <Field label={label}>
      <select className="select" {...props}>{children}</select>
    </Field>
  );
}

export function TextArea({ label, ...props }) {
  return (
    <Field label={label}>
      <textarea className="input" {...props} />
    </Field>
  );
}

export function Button({ children, variant, size, loading, className = '', ...props }) {
  const cls = ['btn', variant || '', size || '', className].filter(Boolean).join(' ');
  return (
    <button className={cls} disabled={loading || props.disabled} {...props}>
      {loading ? '…' : children}
    </button>
  );
}

const BADGE = {
  // pharmacy approval / generic
  approved: 'green', active: 'green', delivered: 'green', resolved: 'green', verified: 'green', completed: 'green', accepted: 'green', paid: 'green', in_stock: 'green',
  pending: 'amber', under_review: 'amber', preparing: 'amber', out_for_delivery: 'amber', open: 'blue', placed: 'blue', requested: 'amber', assigned: 'blue', on_the_way: 'blue', picked_up: 'blue', matched: 'blue', in_progress: 'amber',
  rejected: 'red', suspended: 'red', blocked: 'red', cancelled: 'red', failed: 'red', out_of_stock: 'red',
};

// Production-ready, human labels for the raw status enums. Anything not listed
// falls back to a Title-cased version of the raw value.
const BADGE_LABEL = {
  pending: 'Pending review', under_review: 'Under review', approved: 'Approved', rejected: 'Rejected',
  suspended: 'Suspended', active: 'Active', blocked: 'Blocked', deleted: 'Deleted', verified: 'Verified',
  uploaded: 'Uploaded',
  placed: 'Order placed', accepted: 'Accepted', preparing: 'Preparing', out_for_delivery: 'Out for delivery',
  delivered: 'Delivered', cancelled: 'Cancelled', failed: 'Failed', paid: 'Paid',
  requested: 'Requested', assigned: 'Assigned', on_the_way: 'On the way', picked_up: 'Picked up', completed: 'Completed',
  open: 'Open', matched: 'Matched', fulfilled: 'Fulfilled', expired: 'Expired',
  in_stock: 'In stock', out_of_stock: 'Out of stock', resolved: 'Resolved', in_progress: 'In progress',
};

export function Badge({ value }) {
  const tone = BADGE[value] || 'gray';
  const label = BADGE_LABEL[value] || String(value || '').replace(/_/g, ' ');
  return <span className={`badge ${tone}`}>{label}</span>;
}

export function Stat({ label, value, icon }) {
  return (
    <div className="stat">
      <span className="ico">{icon}</span>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

export function Loader({ text = 'Loading…' }) {
  return <div className="empty">{text}</div>;
}

// Prev/next pager for list pages backed by a { items, total, page, limit }
// response. Renders nothing when everything fits on one page.
export function Pagination({ page, limit, total, onPage }) {
  const pages = Math.max(1, Math.ceil((total || 0) / (limit || 1)));
  if (pages <= 1) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
      <span className="muted">Showing {from}–{to} of {total}</span>
      <div style={{ flex: 1 }} />
      <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Prev</Button>
      <span className="muted">Page {page} of {pages}</span>
      <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next ›</Button>
    </div>
  );
}

export function Empty({ icon, title, sub }) {
  return (
    <div className="empty">
      <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--muted)' }}>
        {icon || <Icon name="inbox" size={40} strokeWidth={1.5} />}
      </div>
      <div style={{ fontWeight: 600, marginTop: 8, color: 'var(--text)' }}>{title}</div>
      {sub && <div style={{ marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// Shown when a fetch fails — distinguishes a real error from genuinely empty
// data, with an optional retry.
export function ErrorState({ message = 'Couldn’t load this. Please try again.', onRetry }) {
  return (
    <div className="empty">
      <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--warning)' }}>
        <Icon name="warning" size={40} strokeWidth={1.5} />
      </div>
      <div style={{ fontWeight: 600, marginTop: 8, color: 'var(--text)' }}>Something went wrong</div>
      <div style={{ marginTop: 4 }}>{message}</div>
      {onRetry && <Button variant="outline" style={{ marginTop: 14 }} onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = 520 }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,32,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, padding: 24, width, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,.25)' }}>
        {title && <h3 style={{ marginBottom: 16, fontSize: 18 }}>{title}</h3>}
        {children}
      </div>
    </div>
  );
}

export function money(n) {
  return `₹${Number(n || 0).toFixed(0)}`;
}

// A small modal that collects a text reason — a proper replacement for
// window.prompt (which can't be styled and treats cancel as an empty reason).
export function ReasonModal({ open, title = 'Add a reason', label = 'Reason', placeholder = '', confirmLabel = 'Confirm', confirmVariant = 'danger', required = true, loading, onConfirm, onClose }) {
  const [value, setValue] = useState('');
  useEffect(() => { if (open) setValue(''); }, [open]);
  if (!open) return null;
  const submit = (e) => {
    e.preventDefault();
    if (required && !value.trim()) return;
    onConfirm(value.trim());
  };
  return (
    <Modal open={open} onClose={onClose} title={title} width={440}>
      <form onSubmit={submit}>
        <Field label={label}>
          <textarea className="input" rows={3} value={value} autoFocus
            onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
        </Field>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Button type="button" variant="ghost" onClick={onClose} style={{ flex: 1 }} disabled={loading}>Cancel</Button>
          <Button type="submit" variant={confirmVariant} loading={loading} style={{ flex: 1 }} disabled={required && !value.trim()}>{confirmLabel}</Button>
        </div>
      </form>
    </Modal>
  );
}
