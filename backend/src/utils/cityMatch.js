/**
 * City matching for the blood and ambulance flows.
 *
 * Cities are free text, and people cover an area rather than a point: an
 * ambulance driver serves "Mohali, Kharar, Chandigarh" and a blood donor can
 * reach any of the neighbouring towns. Both store that as one comma-separated
 * list, and a request naming any city in the list must reach them.
 *
 * So we match on TOKEN OVERLAP — two cities match when they share at least one
 * significant word, in any order. Plain substring matching misses this (e.g.
 * "Kharar, Mohali" is not a substring of "Chandigarh, Mohali", yet both cover
 * Mohali).
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

/**
 * Knex whereRaw fragment: the SQL half of citiesOverlap — does `column` contain
 * ANY significant token of `city`? SQL can't tokenize, so this is a deliberately
 * *recall-safe* prefilter: LIKE matches substrings, so "ala" would also hit
 * "Ambala". Always re-filter the rows it returns with citiesOverlap() in JS,
 * which compares whole tokens and is the real decision.
 *
 * Usage: const c = cityOverlapRaw('r.city', donor.city);
 *        qb.whereRaw(c.clause, c.bindings);  // then .filter(citiesOverlap(...))
 * NOTE: `column` is an internal identifier (never user input).
 */
function cityOverlapRaw(column, city) {
  const tokens = cityTokens(city);
  if (!tokens.length) return { clause: '1 = 0', bindings: [] }; // no city -> no match
  const col = `LOWER(${column})`;
  const clause = `(${tokens.map(() => `${col} LIKE CONCAT('%', ?, '%')`).join(' OR ')})`;
  return { clause, bindings: tokens };
}

/**
 * Tidy a free-text city list into the canonical comma-separated form we store:
 * trimmed, blank- and duplicate-free (case-insensitive), and short enough to fit
 * the column. Also accepts an array. Single-city users are just a list of one.
 */
const MAX_CITIES = 8;
const CITY_FIELD_MAX = 255; // user_profiles.city / donor_profiles.city column width

function normalizeCityList(value) {
  const parts = (Array.isArray(value) ? value : String(value == null ? '' : value).split(','))
    .map((c) => String(c).trim().replace(/\s+/g, ' '))
    .filter(Boolean);

  const seen = new Set();
  const kept = [];
  for (const city of parts) {
    const key = city.toLowerCase();
    if (seen.has(key)) continue;
    // Stop before overflowing the column rather than truncating a city name.
    if (kept.concat(city).join(', ').length > CITY_FIELD_MAX) break;
    seen.add(key);
    kept.push(city);
    if (kept.length >= MAX_CITIES) break;
  }
  return kept.join(', ');
}

module.exports = { cityTokens, citiesOverlap, cityOverlapRaw, normalizeCityList, MAX_CITIES };
