const { citiesOverlap } = require('./cityMatch');
const { distanceKm } = require('./geo');

// How far from the delivery address a pharmacy can still be and reach it.
const RADIUS_KM = 10;

/**
 * Can `place` (a pharmacy) serve `target` (a delivery address)?
 *
 * Either rule is enough — this is a union, not an intersection:
 *   1. it is within RADIUS_KM of the address, or
 *   2. its city matches the address's city (token overlap, the same rule the
 *      blood and ambulance flows use, so "Kharar" reaches a Mohali pharmacy).
 *
 * Rule 2 is what keeps the union honest: pharmacies registered before we started
 * capturing coordinates have none, and a user may not have pinned their address.
 * A missing coordinate must fall back to city matching, never hide the pharmacy.
 *
 * Kept in one place because the catalog (what you can see) and the order
 * endpoint (what you can buy) must agree — if they drift, users get shown
 * medicines they are then refused at checkout.
 */
function servesTarget(target, place) {
  if (!target || !place) return false;
  const km = distanceKm(target, place);
  if (km !== null && km <= RADIUS_KM) return true;
  return citiesOverlap(target.city, place.city);
}

module.exports = { servesTarget, RADIUS_KM };
