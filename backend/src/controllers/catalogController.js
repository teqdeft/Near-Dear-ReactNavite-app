const db = require('../db/knex');
const { ok } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { normalize, bestScore } = require('../utils/search');
const { distanceKm } = require('../utils/geo');
const { servesTarget } = require('../utils/serviceArea');
const { PHARMACY_APPROVAL, ACTIVE_STATUS } = require('../constants/enums');

// GET /catalog/categories
const categories = asyncHandler(async (req, res) => {
  const rows = await db('medicine_categories').where({ status: ACTIVE_STATUS.ACTIVE }).orderBy('name');
  return ok(res, rows);
});

/**
 * Where the order is going — NOT where the phone currently is. Someone in Delhi
 * ordering medicine for their family home in Mohali must see Mohali pharmacies,
 * so the delivery address is the source of truth and GPS never overrides it.
 *
 * Priority: the address the user picked -> their default address -> (no address
 * saved yet) their profile city, which gives city matching but no radius.
 */
async function resolveDeliveryTarget(userId, query) {
  if (query.address_id) {
    // Scoped to the user: an id from someone else's account must not leak.
    const picked = await db('user_addresses')
      .where({ id: query.address_id, user_id: userId })
      .first();
    if (!picked) throw ApiError.notFound('Delivery address not found');
    return picked;
  }

  const fallback = await db('user_addresses')
    .where({ user_id: userId })
    .orderBy('is_default', 'desc')
    .orderBy('id', 'desc')
    .first();
  if (fallback) return fallback;

  const profile = await db('user_profiles').where({ user_id: userId }).first();
  return profile && profile.city ? { city: profile.city, latitude: null, longitude: null } : null;
}

/**
 * The approved pharmacies that can serve `target`, as an id list. The rule lives
 * in utils/serviceArea so the catalog and the order endpoint can't disagree.
 *
 * Filtered in JS rather than SQL because the pharmacies table is small and
 * haversine can't use an index anyway. If it grows past a few thousand rows,
 * add a bounding-box WHERE before this.
 */
async function servingPharmacyIds(target) {
  const pharmacies = await db('pharmacies')
    .where('approval_status', PHARMACY_APPROVAL.APPROVED)
    .select('id', 'city', 'latitude', 'longitude');

  return pharmacies.filter((ph) => servesTarget(target, ph)).map((ph) => ph.id);
}

// GET /catalog/medicines?search=&category_id=&address_id=
// Pharmacy listings (approved pharmacies, active listings only), scoped to the
// pharmacies that can actually serve the user's delivery address.
const medicines = asyncHandler(async (req, res) => {
  const { search, category_id } = req.query;

  const target = await resolveDeliveryTarget(req.user.id, req.query);
  // No address and no profile city: we have nothing to scope by, so rather than
  // guess, show everything approved. (Profile setup makes this rare.)
  const servingIds = target ? await servingPharmacyIds(target) : null;
  if (servingIds && servingIds.length === 0) return ok(res, []);

  const q = db('pharmacy_medicines as pm')
    .join('pharmacies as ph', 'ph.id', 'pm.pharmacy_id')
    .leftJoin('medicines as m', 'm.id', 'pm.medicine_id')
    .where('ph.approval_status', PHARMACY_APPROVAL.APPROVED)
    .andWhere('pm.status', ACTIVE_STATUS.ACTIVE)
    .select(
      'pm.id', 'pm.price', 'pm.mrp', 'pm.stock_status', 'pm.prescription_required',
      'pm.pharmacy_id', 'ph.pharmacy_name', 'ph.city as pharmacy_city',
      'ph.latitude as pharmacy_latitude', 'ph.longitude as pharmacy_longitude',
      'pm.medicine_id', 'pm.custom_name',
      'm.name as medicine_name', 'm.brand_name', 'm.strength', 'm.form', 'm.image_url',
      db.raw('COALESCE(pm.category_id, m.category_id) as category_id')
    );

  // The pharmacy's own listing category wins; the master medicine's category
  // is the fallback (e.g. seeded listings without an explicit override).
  if (category_id) {
    q.andWhereRaw('COALESCE(pm.category_id, m.category_id) = ?', [category_id]);
  }
  // Restrict to the serving set BEFORE the search candidate cap below, so we
  // never rank rows that would then be filtered out.
  if (servingIds) q.whereIn('ph.id', servingIds);

  // Page through results (?page=) instead of silently truncating at a fixed cap.
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const offset = (Math.max(1, Number(req.query.page) || 1) - 1) * limit;
  // distance_km is null when either side has no coordinates — the UI must then
  // say nothing rather than imply the pharmacy is at zero distance.
  const toDisplay = (r) => {
    const km = target
      ? distanceKm(target, { latitude: r.pharmacy_latitude, longitude: r.pharmacy_longitude })
      : null;
    return {
      ...r,
      display_name: r.medicine_name || r.custom_name,
      distance_km: km === null ? null : Math.round(km * 10) / 10,
    };
  };

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
