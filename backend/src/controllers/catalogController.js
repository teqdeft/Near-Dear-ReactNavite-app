const db = require('../db/knex');
const { ok } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { normalize, bestScore } = require('../utils/search');
const { PHARMACY_APPROVAL, ACTIVE_STATUS } = require('../constants/enums');

// GET /catalog/categories
const categories = asyncHandler(async (req, res) => {
  const rows = await db('medicine_categories').where({ status: ACTIVE_STATUS.ACTIVE }).orderBy('name');
  return ok(res, rows);
});

// The city we should show pharmacies for: the user's profile city, else their
// default (or most recent) saved address city. Returns null if none is set.
async function resolveUserCity(userId) {
  const profile = await db('user_profiles').where({ user_id: userId }).first();
  if (profile && profile.city) return profile.city;
  const address = await db('user_addresses')
    .where({ user_id: userId })
    .orderBy('is_default', 'desc')
    .orderBy('id', 'desc')
    .first();
  return address ? address.city : null;
}

// GET /catalog/medicines?search=&category_id=&city=
// Returns pharmacy listings (only from approved pharmacies, active listings).
// When no explicit city is passed, results are scoped to the user's own city so
// they only see pharmacies that can realistically serve them.
const medicines = asyncHandler(async (req, res) => {
  const { search, category_id } = req.query;
  const city = req.query.city || await resolveUserCity(req.user.id);
  const q = db('pharmacy_medicines as pm')
    .join('pharmacies as ph', 'ph.id', 'pm.pharmacy_id')
    .leftJoin('medicines as m', 'm.id', 'pm.medicine_id')
    .where('ph.approval_status', PHARMACY_APPROVAL.APPROVED)
    .andWhere('pm.status', ACTIVE_STATUS.ACTIVE)
    .select(
      'pm.id', 'pm.price', 'pm.mrp', 'pm.stock_status', 'pm.prescription_required',
      'pm.pharmacy_id', 'ph.pharmacy_name', 'ph.city as pharmacy_city',
      'pm.medicine_id', 'pm.custom_name',
      'm.name as medicine_name', 'm.brand_name', 'm.strength', 'm.form', 'm.image_url',
      db.raw('COALESCE(pm.category_id, m.category_id) as category_id')
    );

  // The pharmacy's own listing category wins; the master medicine's category
  // is the fallback (e.g. seeded listings without an explicit override).
  if (category_id) {
    q.andWhereRaw('COALESCE(pm.category_id, m.category_id) = ?', [category_id]);
  }
  if (city) q.andWhereRaw('LOWER(ph.city) = LOWER(?)', [city]);

  // Page through results (?page=) instead of silently truncating at a fixed cap.
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const offset = (Math.max(1, Number(req.query.page) || 1) - 1) * limit;
  const toDisplay = (r) => ({ ...r, display_name: r.medicine_name || r.custom_name });

  const queryNorm = normalize(search);
  if (queryNorm) {
    // Typo-tolerant search: fetch the (bounded) candidate set, then rank in the
    // app layer so exact/substring hits come first and misspellings still match
    // via edit distance ("amoxilon" → "amoxicillin"). See utils/search.js.
    const CANDIDATE_CAP = 1500;
    const candidates = await q.orderBy('pm.id', 'desc').limit(CANDIDATE_CAP);
    const ranked = candidates
      .map((r) => ({ r, score: bestScore(queryNorm, [r.medicine_name, r.brand_name, r.custom_name]) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.r.id - a.r.id);
    const data = ranked.slice(offset, offset + limit).map((x) => toDisplay(x.r));
    return ok(res, data);
  }

  const rows = await q.orderBy('pm.id', 'desc').limit(limit).offset(offset);
  return ok(res, rows.map(toDisplay));
});

// GET /catalog/medicines/:id  — a single pharmacy listing
const medicineDetail = asyncHandler(async (req, res) => {
  const r = await db('pharmacy_medicines as pm')
    .join('pharmacies as ph', 'ph.id', 'pm.pharmacy_id')
    .leftJoin('medicines as m', 'm.id', 'pm.medicine_id')
    .where('pm.id', req.params.id)
    .select(
      'pm.*', 'ph.pharmacy_name', 'ph.city as pharmacy_city', 'ph.approval_status',
      'm.name as medicine_name', 'm.brand_name', 'm.composition', 'm.strength', 'm.form', 'm.image_url'
    )
    .first();
  if (!r) throw ApiError.notFound('Medicine not found');
  r.display_name = r.medicine_name || r.custom_name;
  return ok(res, r);
});

module.exports = { categories, medicines, medicineDetail };
