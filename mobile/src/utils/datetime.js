// Human-friendly date/time formatting used across the app.
// The backend pins its MySQL session to UTC (see knexfile.js), so datetimes
// arrive as "2026-07-02 15:54:43" in UTC. We append 'Z' so each device renders
// them in its own local timezone.

function toDate(value) {
  if (!value) return null;
  const iso = typeof value === 'string' && value.includes(' ') && !value.includes('T')
    ? `${value.replace(' ', 'T')}Z`
    : value;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// e.g. "2 Jul 2026, 3:45 PM"
export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return '';
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// e.g. "2 Jul 2026"
export function formatDate(value) {
  const d = toDate(value);
  if (!d) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
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
  return formatDate(value);
}
