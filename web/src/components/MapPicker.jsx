import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Centre of India — where the map opens when nothing has been pinned yet.
const INDIA = [22.5937, 78.9629];
const PINNED_ZOOM = 16;
const UNPINNED_ZOOM = 5;

/**
 * Pin a point on a map. OpenStreetMap tiles via Leaflet — no API key, no billing
 * account, no per-load cost.
 *
 * Uber-style: the pin is fixed at the centre of the frame and you drag the map
 * underneath it, which is far easier to aim than dropping a marker precisely.
 * The pinned point is committed on `moveend`, not on every frame.
 *
 * value:    { latitude, longitude } | null
 * onChange: ({ latitude, longitude }) => void
 */
export default function MapPicker({ value, onChange, height = 300 }) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  // The map is imperative and long-lived; keep the latest onChange in a ref so
  // the 'moveend' handler never goes stale and we never re-create the map.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  const hasPin = value && value.latitude != null && value.longitude != null;

  useEffect(() => {
    if (mapRef.current || !boxRef.current) return;

    const start = hasPin ? [Number(value.latitude), Number(value.longitude)] : INDIA;
    const map = L.map(boxRef.current, { zoomControl: true })
      .setView(start, hasPin ? PINNED_ZOOM : UNPINNED_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    map.on('moveend', () => {
      const c = map.getCenter();
      onChangeRef.current({ latitude: Number(c.lat.toFixed(7)), longitude: Number(c.lng.toFixed(7)) });
    });

    mapRef.current = map;
    // Leaflet mis-measures its container when the card is still laying out.
    setTimeout(() => map.invalidateSize(), 0);

    return () => { map.remove(); mapRef.current = null; };
    // Mount once. Re-running would tear down the user's map as they drag it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useMyLocation = () => {
    if (!navigator.geolocation) return setError('This browser cannot share a location.');
    setLocating(true); setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        // Recentring fires 'moveend', which commits the new point — no need to
        // call onChange here as well (that would double-fire).
        mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], PINNED_ZOOM);
      },
      (err) => {
        setLocating(false);
        setError(err.code === err.PERMISSION_DENIED
          ? 'Location permission denied — drag the map to your shop instead.'
          : 'Could not get your location — drag the map to your shop instead.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="field">
      <label>Shop location on the map *</label>
      <div className="muted" style={{ marginBottom: 8, marginTop: -2 }}>
        Drag the map so the pin sits on your shop. Customers only see pharmacies near
        their delivery address, so an accurate pin is what brings you orders.
      </div>

      {error && <div className="alert error" style={{ marginBottom: 8 }}>{error}</div>}

      <div style={{ position: 'relative', height, borderRadius: 10, overflow: 'hidden', border: '1px solid #E2E6EA' }}>
        <div ref={boxRef} style={{ position: 'absolute', inset: 0 }} />
        {/* Fixed centre pin. pointerEvents:none so it never eats a map drag. */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -100%)',
          pointerEvents: 'none', zIndex: 500, fontSize: 34, lineHeight: 1,
        }}>📍</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
        <button type="button" className="btn outline sm" onClick={useMyLocation} disabled={locating}>
          {locating ? 'Locating…' : 'Use my current location'}
        </button>
        <span className="muted">
          {hasPin
            ? `Pinned: ${Number(value.latitude).toFixed(5)}, ${Number(value.longitude).toFixed(5)}`
            : 'Not pinned yet'}
        </span>
      </div>
    </div>
  );
}
