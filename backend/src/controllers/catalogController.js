const db = require('../db/knex');
const { ok } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { PHARMACY_APPROVAL, ACTIVE_STATUS } = require('../constants/enums');

// GET /catalog/categories
const categories = asyncHandler(async (req, res) => {
  const rows = await db('medicine_categories').where({ status: ACTIVE_STATUS.ACTIVE }).orderBy('name');
  return ok(res, rows);
});

// GET /catalog/medicines?search=&category_id=&city=
// Returns pharmacy listings (only from approved pharmacies, active listings).
const medicines = asyncHandler(async (req, res) => {
  const { search, category_id, city } = req.query;
  const q = db('pharmacy_medicines as pm')
    .join('pharmacies as ph', 'ph.id', 'pm.pharmacy_id')
    .leftJoin('medicines as m', 'm.id', 'pm.medicine_id')
    .where('ph.approval_status', PHARMACY_APPROVAL.APPROVED)
    .andWhere('pm.status', ACTIVE_STATUS.ACTIVE)
    .select(
      'pm.id', 'pm.price', 'pm.mrp', 'pm.stock_status', 'pm.prescription_required',
      'pm.pharmacy_id', 'ph.pharmacy_name', 'ph.city as pharmacy_city',
      'pm.medicine_id', 'pm.custom_name',
      'm.name as medicine_name', 'm.brand_name', 'm.strength', 'm.form', 'm.image_url', 'm.category_id'
    );

  if (category_id) q.andWhere('m.category_id', category_id);
  if (city) q.andWhereRaw('LOWER(ph.city) = LOWER(?)', [city]);
  if (search) {
    q.andWhere((b) => {
      b.whereILike('m.name', `%${search}%`)
        .orWhereILike('m.brand_name', `%${search}%`)
        .orWhereILike('pm.custom_name', `%${search}%`);
    });
  }

  const rows = await q.orderBy('pm.id', 'desc').limit(200);
  // Normalize a display name.
  const data = rows.map((r) => ({ ...r, display_name: r.medicine_name || r.custom_name }));
  return ok(res, data);
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
