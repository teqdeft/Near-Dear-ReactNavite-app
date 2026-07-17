// Typo-tolerant matching for panel list filters. Mirrors backend/src/utils/search.js.
// Substring hits rank highest, and misspellings ("rahol" → "Rahul") are caught
// by Levenshtein similarity, so one wrong letter still finds the row.

// Lowercase + strip everything except letters/digits, so spacing, case and
// punctuation never affect matching.
export function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Classic Levenshtein edit distance with a single rolling row.
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i += 1) {
    const cur = [i];
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

// Score one text against an already-normalized query. 0 = no match.
//  - exact substring (query contained in text)   → 900–1000  (earliest wins)
//  - fuzzy: Levenshtein similarity ≥ FUZZY_MIN    → 0–100     (best typo wins)
const FUZZY_MIN = 0.6;
function scoreText(queryNorm, text) {
  const t = normalize(text);
  if (!t || !queryNorm) return 0;
  const idx = t.indexOf(queryNorm);
  if (idx !== -1) return 1000 - Math.min(idx, 99);
  // Only fuzzy-match queries long enough for a typo to be meaningful; short
  // fragments are already handled by the substring branch above.
  if (queryNorm.length < 4) return 0;
  const sim = 1 - levenshtein(queryNorm, t) / Math.max(queryNorm.length, t.length);
  return sim >= FUZZY_MIN ? Math.round(sim * 100) : 0;
}

// Best score across a row's searchable fields (e.g. name / mobile / email).
export function bestScore(queryNorm, texts) {
  let best = 0;
  for (const t of texts) {
    const s = scoreText(queryNorm, t);
    if (s > best) best = s;
  }
  return best;
}
