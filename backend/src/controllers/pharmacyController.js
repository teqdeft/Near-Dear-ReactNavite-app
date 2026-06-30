const db = require('../db/knex');
const config = require('../config');
const { ok, created } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notify } = require('../services/notificationService');
const {
  ROLES, PHARMACY_APPROVAL, DOC_TYPE, DOC_STATUS, ORDER_STATUS,
  PRESCRIPTION_STATUS, NOTIFICATION_TYPE,
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
    .where('pm.pharmacy_id', pharmacy.id)
    .select('pm.*', 'm.name as master_name', 'm.strength', 'm.form')
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
  if (!b.medicine_id && !b.custom_name) {
    throw ApiError.badRequest('Provide either medicine_id or custom_name');
  }
  const [id] = await db('pharmacy_medicines').insert({
    pharmacy_id: pharmacy.id,
    medicine_id: b.medicine_id || null,
    custom_name: b.custom_name || null,
    price: b.price,
    mrp: b.mrp,
    stock_status: b.stock_status || 'in_stock',
    quantity_available: b.quantity_available,
    prescription_required: Boolean(b.prescription_required),
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
  const allowed = ['custom_name', 'price', 'mrp', 'stock_status', 'quantity_available', 'prescription_required', 'status'];
  const update = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  if (Object.keys(update).length) await db('pharmacy_medicines').where({ id: row.id }).update(update);
  const updated = await db('pharmacy_medicines').where({ id: row.id }).first();
  return ok(res, updated, 'Listing updated');
});

// ---- Order management -------------------------------------------------

// GET /pharmacy/orders?status=
const listOrders = asyncHandler(async (req, res) => {
  const pharmacy = await requireOwnedPharmacy(req);
  const q = db('medicine_orders').where({ pharmacy_id: pharmacy.id });
  if (req.query.status) q.andWhere('order_status', req.query.status);
  const rows = await q.orderBy('id', 'desc');
  return ok(res, rows);
});

// GET /pharmacy/orders/:id
const orderDetail = asyncHandler(async (req, res) => {
  const pharmacy = await requireOwnedPharmacy(req);
  const order = await db('medicine_orders').where({ id: req.params.id, pharmacy_id: pharmacy.id }).first();
  if (!order) throw ApiError.notFound('Order not found');
  const items = await db('medicine_order_items').where({ order_id: order.id });
  let prescription = null;
  if (order.prescription_id) {
    prescription = await db('prescriptions').where({ id: order.prescription_id }).first();
    if (prescription) prescription.url = fileUrl(prescription.file_url);
  }
  const address = order.delivery_address_id
    ? await db('user_addresses').where({ id: order.delivery_address_id }).first()
    : null;
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
  listMyMedicines, addMedicine, updateMedicine,
  listOrders, orderDetail, updateOrderStatus, reviewPrescription,
};
