// Date/time formatting for the web panel. Mirrors mobile/src/utils/datetime.js.
//
// The backend pins its MySQL session to UTC (see backend/knexfile.js), so
// DATETIME values arrive as "2026-07-14 04:23:16" meaning UTC. Browsers parse
// that space-separated form as *local* time, which silently shows every
// timestamp 5:30 hours early in IST — hence the explicit 'Z'.
//
// DATE columns (date_of_birth, last_donation_date, prescription_date) are the
// opposite case: they are calendar dates, not instants. Converting them across
// timezones can roll them to the wrong day, so formatDate leaves them alone.

// "2026-07-14 04:23:16" (UTC) -> Date
function toDate(value) {
  if (!value) return null;
  const iso = typeof value === 'string' && value.includes(' ') && !value.includes('T')
    ? `${value.replace(' ', 'T')}Z`
    : value;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// For DATETIME columns. e.g. "14 Jul 2026, 9:53 am"
export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return '';
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// For DATE columns. Rendered as-is, with no timezone shift.
export function formatDate(value) {
  if (!value) return '';
  const datePart = String(value).slice(0, 10); // "2026-07-14"
  const [y, m, day] = datePart.split('-').map(Number);
  if (!y || !m || !day) return '';
  // Constructed in local time so the calendar date cannot roll a day either way.
  return new Date(y, m - 1, day).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// Relative label for recent items, falling back to an absolute date.
export function timeAgo(value) {
  const d = toDate(value);
  if (!d) return '';
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 45) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateTime(value);
}
