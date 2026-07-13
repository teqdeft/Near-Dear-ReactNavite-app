/**
 * Distance between two lat/lng points.
 *
 * Pharmacies are matched to a delivery address by road-ish proximity, which we
 * approximate with great-circle distance. This is plain arithmetic — no maps
 * API, no network call, no cost.
 *
 * Coordinates come out of MySQL DECIMAL columns as strings, so everything is
 * coerced through Number() before use.
 */

const EARTH_RADIUS_KM = 6371;

const toRad = (deg) => (deg * Math.PI) / 180;

// A usable coordinate pair, or null. Rejects nulls, non-numerics and the
// (0, 0) "null island" point that a broken form submit tends to produce.
function toCoord(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

// Great-circle (haversine) distance in kilometres, or null when either point is
// missing — callers must treat null as "distance unknown", never as "far".
function distanceKm(a, b) {
  const p = toCoord(a && a.latitude, a && a.longitude);
  const q = toCoord(b && b.latitude, b && b.longitude);
  if (!p || !q) return null;

  const dLat = toRad(q.lat - p.lat);
  const dLng = toRad(q.lng - p.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(p.lat)) * Math.cos(toRad(q.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

module.exports = { distanceKm, toCoord, EARTH_RADIUS_KM };
