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

module.exports = { normalizeCity, citiesMatch, cityMatchRaw };
