const db = require('../db/knex');
const config = require('../config');
const { ok, created } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notify } = require('../services/notificationService');
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
    latitude: b.latitude,
    longitude: b.longitude,
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

// POST /pharmacy/documents  (multipart: file + document_type)
const uploadDocument = asyncHandler(async (req, res) => {
  const pharmacy = await requireOwnedPharmacy(req);
  if (!req.file) throw ApiError.badRequest('A document file is required');
  const documentType = req.body.document_type || DOC_TYPE.OTHER;
  const relPath = `pharmacy_docs/${req.file.filename}`;

  const [id] = await db('pharmacy_documents').insert({
    pharmacy_id: pharmacy.id,
    document_type: documentType,
    file_url: relPath,
    status: DOC_STATUS.PENDING,
  });
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

// GET /pharmacy/orders?status=
const listOrders = asyncHandler(async (req, res) => {
  const pharmacy = await requireOwnedPharmacy(req);
  const q = db('medicine_orders as o')
    .join('users as u', 'u.id', 'o.user_id')
    .where('o.pharmacy_id', pharmacy.id)
    .select('o.*', 'u.name as customer_name', 'u.mobile as customer_mobile');
  if (req.query.status) q.andWhere('o.order_status', req.query.status);
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const offset = (Math.max(1, Number(req.query.page) || 1) - 1) * limit;
  const rows = await q.orderBy('o.id', 'desc').limit(limit).offset(offset);
  return ok(res, rows);
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
  const presc = await db('prescriptions').where({ id: req.params.id }).first();
  if (!presc) throw ApiError.notFound('Prescription not found');
  await db('prescriptions').where({ id: presc.id }).update({
    status,
    reviewed_by_pharmacy_id: pharmacy.id,
    rejection_reason: status === PRESCRIPTION_STATUS.REJECTED ? (reason || 'Rejected') : null,
  });
  return ok(res, { status }, 'Prescription reviewed');
});

module.exports = {
  register, myPharmacy, uploadDocument, dashboard,
  listMyMedicines, addMedicine, updateMedicine, deleteMedicine, addCategory,
  listOrders, orderDetail, updateOrderStatus, reviewPrescription,
};
