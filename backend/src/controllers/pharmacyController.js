const path = require('path');
const fs = require('fs');
const db = require('../db/knex');
const config = require('../config');
const { ok, created } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notify } = require('../services/notificationService');
const { UPLOAD_ROOT } = require('../middleware/upload');
const { renameUpload } = require('../utils/fileNaming');
const { toCoord } = require('../utils/geo');
const {
  ROLES, PHARMACY_APPROVAL, DOC_TYPE, DOC_STATUS, ORDER_STATUS,
  PRESCRIPTION_STATUS, NOTIFICATION_TYPE, ACTIVE_STATUS, MEDICINE_FORM,
} = require('../constants/enums');

function fileUrl(filePath) {
  // filePath is relative to UPLOAD_DIR; served via /api/v1/files
  return `${config.appUrl}/api/v1/files/${filePath}`;
}

// Resolve the pharmacy owned by the current user.
async function ownedPharmacy(userId) {
  const pharmacy = await db('pharmacies').where({ owner_user_id: userId }).first();
  return pharmacy;
}

async function requireOwnedPharmacy(req) {
  const pharmacy = await ownedPharmacy(req.user.id);
  if (!pharmacy) throw ApiError.notFound('No pharmacy linked to your account. Register one first.');
  return pharmacy;
}

// Reject non-sensical pricing/stock so a client can't save a 0/negative price
// or negative quantity (the web form guards this too, but never trust the client).
function validatePricing(b) {
  if (b.price !== undefined && !(Number(b.price) > 0)) {
    throw ApiError.badRequest('Price must be greater than 0');
  }
  if (b.mrp !== undefined && b.mrp !== null && b.mrp !== '' && Number(b.mrp) < 0) {
    throw ApiError.badRequest('MRP cannot be negative');
  }
  if (b.quantity_available !== undefined && b.quantity_available !== null && b.quantity_available !== '' && Number(b.quantity_available) < 0) {
    throw ApiError.badRequest('Quantity cannot be negative');
  }
}

/**
 * The pinned shop location, or nulls if it wasn't pinned.
 *
 * These coordinates decide which customers ever see this pharmacy (see
 * utils/serviceArea), so a junk pair is worse than none: (0, 0) — what an empty
 * map form posts — would place the shop in the Atlantic and hide it from
 * everyone. Reject anything not a real point and store NULL, which falls back to
 * city matching.
 */
function coordsFrom(b) {
  const coord = toCoord(b.latitude, b.longitude);
  if (!coord && (b.latitude != null || b.longitude != null)) {
    throw ApiError.badRequest('The pinned location is not a valid point on the map.');
  }
  return { latitude: coord ? coord.lat : null, longitude: coord ? coord.lng : null };
}

// POST /pharmacy/register
const register = asyncHandler(async (req, res) => {
  const existing = await ownedPharmacy(req.user.id);
  if (existing) throw ApiError.conflict('You already registered a pharmacy');

  const b = req.body;
  const [id] = await db('pharmacies').insert({
    owner_user_id: req.user.id,
    pharmacy_name: b.pharmacy_name,
    owner_name: b.owner_name,
    mobile: b.mobile,
    email: b.email,
    license_number: b.license_number,
    gst_number: b.gst_number,
    address: b.address,
    city: b.city,
    state: b.state,
    pincode: b.pincode,
    ...coordsFrom(b),
    approval_status: PHARMACY_APPROVAL.PENDING,
  });

  // Mark this user as a pharmacy owner.
  if (req.user.role === ROLES.USER || req.user.role === ROLES.DONOR) {
    await db('users').where({ id: req.user.id }).update({ role: ROLES.PHARMACY_OWNER });
  }

  // Notify admins.
  const admins = await db('users').where({ role: ROLES.ADMIN }).select('id');
  await Promise.all(admins.map((a) => notify(a.id, {
    title: 'New pharmacy registration',
    message: `${b.pharmacy_name} is awaiting approval.`,
    type: NOTIFICATION_TYPE.ADMIN,
    referenceId: id,
  })));

  const pharmacy = await db('pharmacies').where({ id }).first();
  return created(res, pharmacy, 'Pharmacy registered. Awaiting admin approval.');
});

// GET /pharmacy/me
const myPharmacy = asyncHandler(async (req, res) => {
  const pharmacy = await ownedPharmacy(req.user.id);
  if (!pharmacy) return ok(res, null);
  const documents = await db('pharmacy_documents').where({ pharmacy_id: pharmacy.id });
  return ok(res, { pharmacy, documents });
});

/**
 * PUT /pharmacy/me — edit the shop's details, above all its pinned location.
 *
 * Deliberately cannot touch license_number / gst_number / approval_status: those
 * are what the admin approved against the uploaded documents, so changing them
 * here would let an approved pharmacy swap in a different licence without any
 * re-review. Those need a fresh document upload, which already resets approval.
 */
const EDITABLE_FIELDS = ['pharmacy_name', 'owner_name', 'mobile', 'email',
  'address', 'city', 'state', 'pincode'];

const updateMyPharmacy = asyncHandler(async (req, res) => {
  const pharmacy = await requireOwnedPharmacy(req);
  const b = req.body;

  const patch = Object.fromEntries(
    EDITABLE_FIELDS.filter((f) => b[f] !== undefined).map((f) => [f, b[f]])
  );
  // Only touch the coordinates when the client actually sent them, so a form
  // that omits the map doesn't silently wipe an existing pin.
  if (b.latitude !== undefined || b.longitude !== undefined) {
    Object.assign(patch, coordsFrom(b));
  }
  if (!Object.keys(patch).length) throw ApiError.badRequest('Nothing to update');

  await db('pharmacies').where({ id: pharmacy.id }).update(patch);
  const updated = await db('pharmacies').where({ id: pharmacy.id }).first();
  return ok(res, updated, 'Pharmacy details updated');
});

// POST /pharmacy/documents  (multipart: file + document_type)
const uploadDocument = asyncHandler(async (req, res) => {
  const pharmacy = await requireOwnedPharmacy(req);
  if (!req.file) throw ApiError.badRequest('A document file is required');
  const documentType = req.body.document_type || DOC_TYPE.OTHER;
  // Save under the pharmacy's name + id + document type so it's identifiable in
  // the uploads folder (e.g. "apollo-pharmacy_12_license_<time>.jpg").
  const relPath = renameUpload(req.file, 'pharmacy_docs', [pharmacy.pharmacy_name, pharmacy.id, documentType]);

  // One document per type: re-uploading (e.g. a renewed drug license) REPLACES
  // the existing file instead of piling up duplicates, and resets it to pending
  // for admin re-review.
  const existing = await db('pharmacy_documents')
    .where({ pharmacy_id: pharmacy.id, document_type: documentType })
    .first();
  let id;
  if (existing) {
    await db('pharmacy_documents').where({ id: existing.id })
      .update({ file_url: relPath, status: DOC_STATUS.PENDING });
    id = existing.id;
    // Best-effort: delete the old file from disk so replaced files don't linger.
    if (existing.file_url) fs.unlink(path.join(UPLOAD_ROOT, existing.file_url), () => {});
  } else {
    [id] = await db('pharmacy_documents').insert({
      pharmacy_id: pharmacy.id,
      document_type: documentType,
      file_url: relPath,
      status: DOC_STATUS.PENDING,
    });
  }

  // If the pharmacy was already approved, changing a document means it must be
  // re-verified — send it back to pending (selling stops until re-approved) and
  // alert the admins that a re-review is waiting.
  if (pharmacy.approval_status === PHARMACY_APPROVAL.APPROVED) {
    await db('pharmacies').where({ id: pharmacy.id })
      .update({ approval_status: PHARMACY_APPROVAL.PENDING, approved_at: null, approved_by: null });
    const admins = await db('users').where({ role: ROLES.ADMIN }).select('id');
    await Promise.all(admins.map((a) => notify(a.id, {
      title: 'Pharmacy document re-uploaded',
      message: `${pharmacy.pharmacy_name} re-uploaded a document — needs re-approval.`,
      type: NOTIFICATION_TYPE.ADMIN,
      referenceId: pharmacy.id,
    })));
  }

  const doc = await db('pharmacy_documents').where({ id }).first();
  return created(res, { ...doc, url: fileUrl(doc.file_url) }, 'Document uploaded');
});

// GET /pharmacy/dashboard
const dashboard = asyncHandler(async (req, res) => {
  const pharmacy = await requireOwnedPharmacy(req);
  const counts = await db('medicine_orders')
    .where({ pharmacy_id: pharmacy.id })
    .select('order_status')
    .count('* as c')
    .groupBy('order_status');
  const byStatus = Object.fromEntries(counts.map((r) => [r.order_status, Number(r.c)]));
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  return ok(res, {
    pharmacy: { id: pharmacy.id, name: pharmacy.pharmacy_name, approval_status: pharmacy.approval_status },
    orders: {
      total,
      placed: byStatus[ORDER_STATUS.PLACED] || 0,
      accepted: byStatus[ORDER_STATUS.ACCEPTED] || 0,
      preparing: byStatus[ORDER_STATUS.PREPARING] || 0,
      out_for_delivery: byStatus[ORDER_STATUS.OUT_FOR_DELIVERY] || 0,
      delivered: byStatus[ORDER_STATUS.DELIVERED] || 0,
      rejected: byStatus[ORDER_STATUS.REJECTED] || 0,
    },
  });
});

// ---- Medicine listing CRUD (pharmacy_medicines) -----------------------

// GET /pharmacy/medicines
const listMyMedicines = asyncHandler(async (req, res) => {
  const pharmacy = await requireOwnedPharmacy(req);
  const rows = await db('pharmacy_medicines as pm')
    .leftJoin('medicines as m', 'm.id', 'pm.medicine_id')
    .leftJoin('medicine_categories as c', 'c.id', 'pm.category_id')
    .where('pm.pharmacy_id', pharmacy.id)
    .select('pm.*', 'm.name as master_name', 'm.brand_name', 'm.composition', 'm.strength', 'm.form', 'c.name as category_name')
    .orderBy('pm.id', 'desc');
  return ok(res, rows);
});

// POST /pharmacy/medicines
const addMedicine = asyncHandler(async (req, res) => {
  const pharmacy = await requireOwnedPharmacy(req);
  if (pharmacy.approval_status !== PHARMACY_APPROVAL.APPROVED) {
    throw ApiError.forbidden('Your pharmacy must be approved before listing medicines');
  }
  const b = req.body;
  const name = (b.custom_name || '').trim();
  if (!b.medicine_id && !name) {
    throw ApiError.badRequest('Provide either medicine_id or a medicine name');
  }
  validatePricing(b);

  // Reject a listing this pharmacy already carries — matched against both the
  // linked master medicine's name and any legacy custom_name — so the
  // catalogue stays free of dupes.
  const dupQuery = db('pharmacy_medicines as pm')
    .leftJoin('medicines as m', 'm.id', 'pm.medicine_id')
    .where('pm.pharmacy_id', pharmacy.id);
  if (b.medicine_id) {
    dupQuery.andWhere('pm.medicine_id', b.medicine_id);
  } else {
    dupQuery.andWhere((q) => {
      q.whereRaw('LOWER(pm.custom_name) = LOWER(?)', [name])
        .orWhereRaw('LOWER(m.name) = LOWER(?)', [name]);
    });
  }
  const duplicate = await dupQuery.first();
  if (duplicate) throw ApiError.conflict('This medicine is already in your listings');

  // Resolve the master medicine. Custom entries get a master row so their
  // composition/strength/form live in `medicines` (shared, normalized) rather
  // than being lost — reusing an identical existing master when one exists.
  const categoryId = b.category_id || null;
  const rxRequired = Boolean(b.prescription_required);
  let medicineId = b.medicine_id || null;

  if (!medicineId) {
    const strength = (b.strength || '').trim() || null;
    const form = b.form || MEDICINE_FORM.TABLET;
    const existingMaster = await db('medicines')
      .whereRaw('LOWER(name) = LOWER(?)', [name])
      .andWhere((q) => (strength ? q.where('strength', strength) : q.whereNull('strength')))
      .andWhere('form', form)
      .first();

    if (existingMaster) {
      medicineId = existingMaster.id;
    } else {
      [medicineId] = await db('medicines').insert({
        category_id: categoryId,
        name,
        brand_name: (b.brand_name || '').trim() || null,
        composition: (b.composition || '').trim() || null,
        strength,
        form,
        prescription_required: rxRequired,
        status: ACTIVE_STATUS.ACTIVE,
      });
    }
  }

  const [id] = await db('pharmacy_medicines').insert({
    pharmacy_id: pharmacy.id,
    medicine_id: medicineId,
    custom_name: null,
    category_id: categoryId,
    price: b.price,
    mrp: b.mrp,
    stock_status: b.stock_status || 'in_stock',
    quantity_available: b.quantity_available,
    prescription_required: rxRequired,
    status: b.status || 'active',
  });
  const row = await db('pharmacy_medicines').where({ id }).first();
  return created(res, row, 'Medicine added to your listing');
});

// PUT /pharmacy/medicines/:id
const updateMedicine = asyncHandler(async (req, res) => {
  const pharmacy = await requireOwnedPharmacy(req);
  const row = await db('pharmacy_medicines').where({ id: req.params.id, pharmacy_id: pharmacy.id }).first();
  if (!row) throw ApiError.notFound('Listing not found');
  const b = req.body;
  validatePricing(b);

  // Listing-level fields live on pharmacy_medicines.
  const listingAllowed = ['category_id', 'price', 'mrp', 'stock_status', 'quantity_available', 'prescription_required', 'status'];
  const update = Object.fromEntries(Object.entries(b).filter(([k]) => listingAllowed.includes(k)));

  // Master-level fields (name/brand/composition/strength/form) live on the
  // shared `medicines` row. Build the patch only from keys the client sent.
  const masterFields = { name: 'name', brand_name: 'brand_name', composition: 'composition', strength: 'strength', form: 'form' };
  const masterPatch = {};
  for (const [payloadKey, col] of Object.entries(masterFields)) {
    if (b[payloadKey] !== undefined) {
      const v = typeof b[payloadKey] === 'string' ? b[payloadKey].trim() : b[payloadKey];
      masterPatch[col] = v === '' ? null : v;
    }
  }
  if (b.prescription_required !== undefined) masterPatch.prescription_required = Boolean(b.prescription_required);
  if (masterPatch.name === null) delete masterPatch.name; // never blank out the name

  if (Object.keys(masterPatch).length) {
    if (!row.medicine_id) {
      // Legacy custom listing (no master yet): create one and link it.
      const [medId] = await db('medicines').insert({
        category_id: update.category_id ?? row.category_id ?? null,
        name: masterPatch.name || row.custom_name,
        brand_name: masterPatch.brand_name ?? null,
        composition: masterPatch.composition ?? null,
        strength: masterPatch.strength ?? null,
        form: masterPatch.form || MEDICINE_FORM.TABLET,
        prescription_required: masterPatch.prescription_required ?? Boolean(row.prescription_required),
        status: ACTIVE_STATUS.ACTIVE,
      });
      update.medicine_id = medId;
      update.custom_name = null;
    } else {
      const [{ c: refCount }] = await db('pharmacy_medicines')
        .where({ medicine_id: row.medicine_id }).count('* as c');
      if (Number(refCount) > 1) {
        // Master is shared with other pharmacies — fork a private copy so this
        // edit doesn't rewrite their listings, then relink.
        const master = await db('medicines').where({ id: row.medicine_id }).first();
        const { id, created_at, updated_at, ...clone } = master;
        const [medId] = await db('medicines').insert({ ...clone, ...masterPatch });
        update.medicine_id = medId;
      } else {
        await db('medicines').where({ id: row.medicine_id }).update(masterPatch);
      }
    }
  }

  if (Object.keys(update).length) await db('pharmacy_medicines').where({ id: row.id }).update(update);
  const updated = await db('pharmacy_medicines').where({ id: row.id }).first();
  return ok(res, updated, 'Listing updated');
});

// DELETE /pharmacy/medicines/:id
const deleteMedicine = asyncHandler(async (req, res) => {
  const pharmacy = await requireOwnedPharmacy(req);
  const row = await db('pharmacy_medicines').where({ id: req.params.id, pharmacy_id: pharmacy.id }).first();
  if (!row) throw ApiError.notFound('Listing not found');
  // Only the pharmacy's listing is removed; the master medicine and any order
  // snapshots stay intact (medicine_order_items keeps its own name/price copy).
  await db('pharmacy_medicines').where({ id: row.id }).del();
  return ok(res, { id: row.id }, 'Medicine removed from your listings');
});

// POST /pharmacy/categories  — owner adds a category on the fly while listing.
// Idempotent on slug: an existing category with the same slug is reused.
const addCategory = asyncHandler(async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) throw ApiError.badRequest('Category name is required');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const existing = await db('medicine_categories').where({ slug }).first();
  if (existing) return ok(res, existing, 'Category already exists');

  const [id] = await db('medicine_categories').insert({
    name, slug, status: ACTIVE_STATUS.ACTIVE,
  });
  const category = await db('medicine_categories').where({ id }).first();
  return created(res, category, 'Category added');
});

// ---- Order management -------------------------------------------------

// GET /pharmacy/orders?status=&search=
const listOrders = asyncHandler(async (req, res) => {
  const pharmacy = await requireOwnedPharmacy(req);
  const q = db('medicine_orders as o')
    .join('users as u', 'u.id', 'o.user_id')
    .where('o.pharmacy_id', pharmacy.id);
  if (req.query.status) q.andWhere('o.order_status', req.query.status);
  if (req.query.search) {
    const s = `%${req.query.search}%`;
    q.andWhere((b) => b.whereILike('o.order_number', s).orWhereILike('u.name', s).orWhereILike('u.mobile', s));
  }
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const page = Math.max(1, Number(req.query.page) || 1);
  const rows = await q.clone().select('o.*', 'u.name as customer_name', 'u.mobile as customer_mobile')
    .orderBy('o.id', 'desc').limit(limit).offset((page - 1) * limit);
  const total = Number((await q.clone().count('o.id as c').first()).c);
  return ok(res, { items: rows, total, page, limit });
});

// GET /pharmacy/sales  — revenue summary + 7-day trend + top medicines + low stock
const salesSummary = asyncHandler(async (req, res) => {
  const pharmacy = await requireOwnedPharmacy(req);
  const pid = pharmacy.id;
  const DELIVERED = ORDER_STATUS.DELIVERED;

  const [totalRow, todayRow, statusCounts, topMedicines, dailyRows, lowStockRow] = await Promise.all([
    db('medicine_orders').where({ pharmacy_id: pid, order_status: DELIVERED }).sum('total_amount as v').first(),
    db('medicine_orders').where({ pharmacy_id: pid, order_status: DELIVERED }).andWhereRaw('DATE(created_at) = CURDATE()').sum('total_amount as v').first(),
    db('medicine_orders').where({ pharmacy_id: pid }).select('order_status').count('* as c').groupBy('order_status'),
    db('medicine_order_items as oi').join('medicine_orders as o', 'o.id', 'oi.order_id')
      .where('o.pharmacy_id', pid).andWhere('o.order_status', DELIVERED)
      .select('oi.medicine_name_snapshot as name').sum('oi.quantity as qty').sum('oi.total_price as revenue')
      .groupBy('oi.medicine_name_snapshot').orderBy('qty', 'desc').limit(5),
    db('medicine_orders').where({ pharmacy_id: pid, order_status: DELIVERED })
      .andWhereRaw('created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)')
      .select(db.raw('DATE(created_at) as day'), db.raw('SUM(total_amount) as revenue'), db.raw('COUNT(*) as orders'))
      .groupByRaw('DATE(created_at)'),
    db('pharmacy_medicines').where({ pharmacy_id: pid, status: 'active' })
      .whereNotNull('quantity_available').andWhere('quantity_available', '<=', 10).count('* as c').first(),
  ]);

  const byStatus = Object.fromEntries(statusCounts.map((r) => [r.order_status, Number(r.c)]));
  // Build a continuous 7-day series (fill missing days with 0), in local dates.
  const byDay = {};
  dailyRows.forEach((r) => { byDay[String(r.day).slice(0, 10)] = { revenue: Number(r.revenue), orders: Number(r.orders) }; });
  const daily = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    daily.push({ day: key, revenue: byDay[key]?.revenue || 0, orders: byDay[key]?.orders || 0 });
  }

  return ok(res, {
    total_revenue: Number(totalRow?.v || 0),
    today_revenue: Number(todayRow?.v || 0),
    orders: {
      total: Object.values(byStatus).reduce((a, b) => a + b, 0),
      delivered: byStatus[DELIVERED] || 0,
      placed: byStatus[ORDER_STATUS.PLACED] || 0,
      pending: (byStatus[ORDER_STATUS.PLACED] || 0) + (byStatus[ORDER_STATUS.ACCEPTED] || 0) + (byStatus[ORDER_STATUS.PREPARING] || 0) + (byStatus[ORDER_STATUS.OUT_FOR_DELIVERY] || 0),
    },
    top_medicines: topMedicines.map((m) => ({ name: m.name, qty: Number(m.qty), revenue: Number(m.revenue) })),
    daily,
    low_stock_count: Number(lowStockRow?.c || 0),
  });
});

// GET /pharmacy/orders/:id
const orderDetail = asyncHandler(async (req, res) => {
  const pharmacy = await requireOwnedPharmacy(req);
  const order = await db('medicine_orders as o')
    .join('users as u', 'u.id', 'o.user_id')
    .where({ 'o.id': req.params.id, 'o.pharmacy_id': pharmacy.id })
    .select('o.*', 'u.name as customer_name', 'u.mobile as customer_mobile')
    .first();
  if (!order) throw ApiError.notFound('Order not found');
  // Independent reads — fetch them together.
  const [items, prescription, address] = await Promise.all([
    db('medicine_order_items').where({ order_id: order.id }),
    order.prescription_id
      ? db('prescriptions').where({ id: order.prescription_id }).first()
      : Promise.resolve(null),
    order.delivery_address_id
      ? db('user_addresses').where({ id: order.delivery_address_id }).first()
      : Promise.resolve(null),
  ]);
  if (prescription) prescription.url = fileUrl(prescription.file_url);
  return ok(res, { order, items, prescription, address });
});

// PUT /pharmacy/orders/:id/status  { status, reason? }
const updateOrderStatus = asyncHandler(async (req, res) => {
  const pharmacy = await requireOwnedPharmacy(req);
  const { status, reason } = req.body;
  const order = await db('medicine_orders').where({ id: req.params.id, pharmacy_id: pharmacy.id }).first();
  if (!order) throw ApiError.notFound('Order not found');

  const allowed = [
    ORDER_STATUS.ACCEPTED, ORDER_STATUS.REJECTED, ORDER_STATUS.PREPARING,
    ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.DELIVERED,
  ];
  if (!allowed.includes(status)) throw ApiError.badRequest('Invalid status for pharmacy');

  // Guard the CURRENT state too — only forward moves are valid. Without this a
  // cancelled/delivered/rejected order could be flipped to any status (e.g. a
  // cancelled order marked "delivered", inflating sales).
  const TRANSITIONS = {
    [ORDER_STATUS.PLACED]: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.REJECTED],
    [ORDER_STATUS.ACCEPTED]: [ORDER_STATUS.PREPARING, ORDER_STATUS.REJECTED],
    [ORDER_STATUS.PREPARING]: [ORDER_STATUS.OUT_FOR_DELIVERY],
    [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED],
  };
  if (!(TRANSITIONS[order.order_status] || []).includes(status)) {
    throw ApiError.conflict(`Cannot change an order from "${order.order_status}" to "${status}".`);
  }

  const update = { order_status: status };
  if (status === ORDER_STATUS.REJECTED) update.rejection_reason = reason || 'Rejected by pharmacy';
  if (status === ORDER_STATUS.DELIVERED) update.delivered_at = db.fn.now();

  await db('medicine_orders').where({ id: order.id }).update(update);
  await db('order_status_history').insert({
    order_id: order.id, status, changed_by_user_id: req.user.id, note: reason || null,
  });
  await notify(order.user_id, {
    title: 'Order update',
    message: `Order ${order.order_number} is now: ${status.replace(/_/g, ' ')}.`,
    type: NOTIFICATION_TYPE.MEDICINE_ORDER,
    referenceId: order.id,
  });
  return ok(res, { status }, 'Order status updated');
});

// PUT /pharmacy/prescriptions/:id/review  { status, reason? }
const reviewPrescription = asyncHandler(async (req, res) => {
  const pharmacy = await requireOwnedPharmacy(req);
  const { status, reason } = req.body;
  if (![PRESCRIPTION_STATUS.APPROVED, PRESCRIPTION_STATUS.REJECTED, PRESCRIPTION_STATUS.UNDER_REVIEW].includes(status)) {
    throw ApiError.badRequest('Invalid prescription status');
  }
  // A pharmacy may review a prescription ONLY if it's attached to one of its
  // own orders — otherwise any pharmacy could approve/reject any user's Rx by id.
  const presc = await db('prescriptions as pr')
    .join('medicine_orders as o', 'o.prescription_id', 'pr.id')
    .where('pr.id', req.params.id)
    .andWhere('o.pharmacy_id', pharmacy.id)
    .select('pr.*')
    .first();
  if (!presc) throw ApiError.notFound('Prescription not found');
  await db('prescriptions').where({ id: presc.id }).update({
    status,
    reviewed_by_pharmacy_id: pharmacy.id,
    rejection_reason: status === PRESCRIPTION_STATUS.REJECTED ? (reason || 'Rejected') : null,
  });
  return ok(res, { status }, 'Prescription reviewed');
});

module.exports = {
  register, myPharmacy, updateMyPharmacy, uploadDocument, dashboard,
  listMyMedicines, addMedicine, updateMedicine, deleteMedicine, addCategory,
  listOrders, orderDetail, updateOrderStatus, reviewPrescription, salesSummary,
};
