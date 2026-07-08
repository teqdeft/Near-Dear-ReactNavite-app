/**
 * City matching for blood/ambulance flows.
 *
 * Cities are free-text, so a donor may save "Chandigarh mohali kharar zirakpur"
 * while a request just says "Chandigarh". Exact equality then fails to match
 * two people who are effectively in the same place. We treat two cities as a
 * match when one *contains* the other (case-insensitive, trimmed) — broad
 * enough for an emergency-donation radius without being wide open.
 */

function normalizeCity(s) {
  return (s || '').trim().toLowerCase();
}

// JS-side match (used when comparing two already-loaded rows).
function citiesMatch(a, b) {
  const x = normalizeCity(a);
  const y = normalizeCity(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

/**
 * Knex whereRaw fragment: does `column` match `city` (bidirectional substring,
 * case-insensitive)? Both sides must be non-empty to match.
 * Usage: const { clause, bindings } = cityMatchRaw('r.city', donor.city);
 *        qb.whereRaw(clause, bindings);
 * NOTE: `column` is an internal identifier (never user input).
 */
function cityMatchRaw(column, city) {
  const norm = normalizeCity(city);
  const col = `LOWER(TRIM(${column}))`;
  const clause = `(? <> '' AND ${col} <> '' AND (${col} = ? OR ${col} LIKE CONCAT('%', ?, '%') OR ? LIKE CONCAT('%', ${col}, '%')))`;
  return { clause, bindings: [norm, norm, norm, norm] };
}

/**
 * Token-overlap city matching. A user can list several adjacent cities in one
 * field ("Mohali Chandigarh Kharar") and so can a driver ("Chandigarh Mohali").
 * They should match if they share ANY city — regardless of word order — which
 * plain substring matching (citiesMatch) misses (e.g. "Kharar Mohali" is not a
 * substring of "Chandigarh Mohali", yet both are in Mohali).
 */

// Generic/directional words that appear in many city names ("New Delhi", "New
// York") — matching on these alone would be a false positive, so we drop them.
const CITY_STOPWORDS = new Set(['new', 'old', 'east', 'west', 'north', 'south', 'nagar', 'city', 'and', 'the']);

// Break a free-text city string into significant, comparable tokens: lowercased,
// punctuation split out, noise/too-short words removed.
function cityTokens(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !CITY_STOPWORDS.has(t));
}

// True when two free-text city strings share at least one significant token.
function citiesOverlap(a, b) {
  const ta = cityTokens(a);
  if (!ta.length) return false;
  const tb = new Set(cityTokens(b));
  return ta.some((t) => tb.has(t));
}

module.exports = { normalizeCity, citiesMatch, cityMatchRaw, cityTokens, citiesOverlap };
