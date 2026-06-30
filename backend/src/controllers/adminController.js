const bcrypt = require('bcryptjs');
const db = require('../db/knex');
const { ok, created } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notify } = require('../services/notificationService');
const { logAction } = require('../services/auditService');
const {
  ROLES, USER_STATUS, PHARMACY_APPROVAL, AMBULANCE_STATUS,
  SUPPORT_STATUS, NOTIFICATION_TYPE, ACTIVE_STATUS,
} = require('../constants/enums');

const ip = (req) => req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;

// GET /admin/dashboard
const dashboard = asyncHandler(async (req, res) => {
  const count = async (table, where = {}) => Number((await db(table).where(where).count('* as c').first()).c);
  const data = {
    users: await count('users', { role: ROLES.USER }),
    donors: await count('donor_profiles'),
    active_blood_requests: await count('blood_requests', { status: 'open' }) + await count('blood_requests', { status: 'matched' }),
    pending_pharmacies: await count('pharmacies', { approval_status: PHARMACY_APPROVAL.PENDING }),
    medicine_orders: await count('medicine_orders'),
    ambulance_requests: await count('ambulance_requests'),
    open_tickets: await count('support_tickets', { status: SUPPORT_STATUS.OPEN }),
  };
  return ok(res, data);
});

// ---- Users ------------------------------------------------------------
const listUsers = asyncHandler(async (req, res) => {
  const { search, role, page = 1, limit = 20 } = req.query;
  const q = db('users').whereNot('role', ROLES.ADMIN);
  if (role) q.andWhere('role', role);
  if (search) q.andWhere((b) => b.whereILike('name', `%${search}%`).orWhereILike('mobile', `%${search}%`));
  const offset = (Number(page) - 1) * Number(limit);
  const rows = await q.clone().select('id', 'name', 'mobile', 'email', 'role', 'status', 'aadhaar_kyc_status', 'created_at')
    .orderBy('id', 'desc').limit(Number(limit)).offset(offset);
  const total = Number((await q.clone().count('* as c').first()).c);
  return ok(res, { items: rows, total, page: Number(page), limit: Number(limit) });
});

const setUserStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (![USER_STATUS.ACTIVE, USER_STATUS.BLOCKED].includes(status)) throw ApiError.badRequest('Invalid status');
  const user = await db('users').where({ id: req.params.id }).first();
  if (!user) throw ApiError.notFound('User not found');
  await db('users').where({ id: user.id }).update({ status });
  await logAction(req.user.id, { action: status === USER_STATUS.BLOCKED ? 'user_blocked' : 'user_unblocked', entityType: 'user', entityId: user.id, oldValue: { status: user.status }, newValue: { status }, ip: ip(req) });
  return ok(res, { status }, 'User status updated');
});

// ---- Pharmacies -------------------------------------------------------
const listPharmacies = asyncHandler(async (req, res) => {
  const q = db('pharmacies');
  if (req.query.status) q.andWhere('approval_status', req.query.status);
  const rows = await q.orderBy('id', 'desc');
  return ok(res, rows);
});

const pharmacyDetail = asyncHandler(async (req, res) => {
  const pharmacy = await db('pharmacies').where({ id: req.params.id }).first();
  if (!pharmacy) throw ApiError.notFound('Pharmacy not found');
  const documents = await db('pharmacy_documents').where({ pharmacy_id: pharmacy.id });
  return ok(res, { pharmacy, documents });
});

const reviewPharmacy = asyncHandler(async (req, res) => {
  const { status, reason } = req.body; // approved | rejected | suspended
  if (![PHARMACY_APPROVAL.APPROVED, PHARMACY_APPROVAL.REJECTED, PHARMACY_APPROVAL.SUSPENDED].includes(status)) {
    throw ApiError.badRequest('Invalid approval status');
  }
  const pharmacy = await db('pharmacies').where({ id: req.params.id }).first();
  if (!pharmacy) throw ApiError.notFound('Pharmacy not found');

  await db('pharmacies').where({ id: pharmacy.id }).update({
    approval_status: status,
    rejection_reason: status === PHARMACY_APPROVAL.REJECTED ? (reason || 'Rejected') : null,
    approved_by: req.user.id,
    approved_at: status === PHARMACY_APPROVAL.APPROVED ? db.fn.now() : null,
  });
  await logAction(req.user.id, { action: `pharmacy_${status}`, entityType: 'pharmacy', entityId: pharmacy.id, oldValue: { status: pharmacy.approval_status }, newValue: { status }, ip: ip(req) });
  await notify(pharmacy.owner_user_id, {
    title: `Pharmacy ${status}`,
    message: status === PHARMACY_APPROVAL.APPROVED
      ? 'Your pharmacy is approved. You can now list medicines.'
      : `Your pharmacy was ${status}. ${reason || ''}`.trim(),
    type: NOTIFICATION_TYPE.ADMIN,
    referenceId: pharmacy.id,
  });
  return ok(res, { status }, `Pharmacy ${status}`);
});

// ---- Blood requests ---------------------------------------------------
const listBloodRequests = asyncHandler(async (req, res) => {
  const q = db('blood_requests');
  if (req.query.status) q.andWhere('status', req.query.status);
  const rows = await q.orderBy('id', 'desc').limit(200);
  return ok(res, rows);
});

const setBloodRequestStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const r = await db('blood_requests').where({ id: req.params.id }).first();
  if (!r) throw ApiError.notFound('Request not found');
  await db('blood_requests').where({ id: r.id }).update({ status });
  await logAction(req.user.id, { action: 'blood_request_status', entityType: 'blood_request', entityId: r.id, newValue: { status }, ip: ip(req) });
  return ok(res, { status }, 'Updated');
});

// ---- Ambulance --------------------------------------------------------
const listAmbulanceRequests = asyncHandler(async (req, res) => {
  const q = db('ambulance_requests');
  if (req.query.status) q.andWhere('status', req.query.status);
  const rows = await q.orderBy('id', 'desc').limit(200);
  return ok(res, rows);
});

const assignAmbulance = asyncHandler(async (req, res) => {
  const { ambulance_id, driver_user_id } = req.body;
  const r = await db('ambulance_requests').where({ id: req.params.id }).first();
  if (!r) throw ApiError.notFound('Request not found');

  let driverId = driver_user_id || null;
  if (ambulance_id && !driverId) {
    const amb = await db('ambulances').where({ id: ambulance_id }).first();
    driverId = amb ? amb.driver_user_id : null;
  }
  await db('ambulance_requests').where({ id: r.id }).update({
    assigned_ambulance_id: ambulance_id || null,
    assigned_driver_id: driverId,
    status: AMBULANCE_STATUS.ASSIGNED,
  });
  if (ambulance_id) await db('ambulances').where({ id: ambulance_id }).update({ status: 'busy' });

  await logAction(req.user.id, { action: 'ambulance_assigned', entityType: 'ambulance_request', entityId: r.id, newValue: { ambulance_id, driverId }, ip: ip(req) });
  await notify(r.user_id, {
    title: 'Ambulance assigned',
    message: 'An ambulance has been assigned to your request.',
    type: NOTIFICATION_TYPE.AMBULANCE,
    referenceId: r.id,
  });
  if (driverId) {
    await notify(driverId, {
      title: 'New ambulance assignment',
      message: `You have been assigned to pick up ${r.patient_name}.`,
      type: NOTIFICATION_TYPE.AMBULANCE,
      referenceId: r.id,
    });
  }
  return ok(res, null, 'Ambulance assigned');
});

// Providers / vehicles / drivers management
const addProvider = asyncHandler(async (req, res) => {
  const { name, contact_mobile, city } = req.body;
  const [id] = await db('ambulance_providers').insert({ name, contact_mobile, city, status: ACTIVE_STATUS.ACTIVE });
  return created(res, await db('ambulance_providers').where({ id }).first(), 'Provider added');
});

// POST /admin/drivers — create an ambulance driver login (mobile + password)
const createDriver = asyncHandler(async (req, res) => {
  const { name, mobile, password } = req.body;
  if (!name || !mobile || !password) throw ApiError.badRequest('name, mobile and password are required');
  const existing = await db('users').where({ mobile }).first();
  if (existing) throw ApiError.conflict('A user with this mobile already exists');
  const password_hash = await bcrypt.hash(password, 10);
  const [id] = await db('users').insert({
    name, mobile, password_hash, role: ROLES.AMBULANCE_DRIVER,
    status: USER_STATUS.ACTIVE, is_mobile_verified: true,
  });
  await logAction(req.user.id, { action: 'driver_created', entityType: 'user', entityId: id, newValue: { mobile }, ip: ip(req) });
  const user = await db('users').where({ id }).select('id', 'name', 'mobile', 'role', 'status').first();
  return created(res, user, 'Driver account created');
});

// GET /admin/drivers — list driver accounts
const listDrivers = asyncHandler(async (req, res) => {
  const rows = await db('users').where({ role: ROLES.AMBULANCE_DRIVER })
    .select('id', 'name', 'mobile', 'status', 'created_at').orderBy('id', 'desc');
  return ok(res, rows);
});

const addAmbulance = asyncHandler(async (req, res) => {
  const { provider_id, vehicle_number, ambulance_type, driver_user_id } = req.body;
  const [id] = await db('ambulances').insert({ provider_id, vehicle_number, ambulance_type: ambulance_type || 'basic', driver_user_id: driver_user_id || null, status: 'available' });
  return created(res, await db('ambulances').where({ id }).first(), 'Ambulance added');
});

const listAmbulances = asyncHandler(async (req, res) => {
  const rows = await db('ambulances as a')
    .leftJoin('ambulance_providers as p', 'p.id', 'a.provider_id')
    .leftJoin('users as d', 'd.id', 'a.driver_user_id')
    .select('a.*', 'p.name as provider_name', 'd.name as driver_name', 'd.mobile as driver_mobile')
    .orderBy('a.id', 'desc');
  return ok(res, rows);
});

// ---- Medicine moderation ---------------------------------------------
const addCategory = asyncHandler(async (req, res) => {
  const { name, slug } = req.body;
  const [id] = await db('medicine_categories').insert({ name, slug, status: ACTIVE_STATUS.ACTIVE });
  return created(res, await db('medicine_categories').where({ id }).first(), 'Category added');
});

const addMasterMedicine = asyncHandler(async (req, res) => {
  const b = req.body;
  const [id] = await db('medicines').insert({
    category_id: b.category_id, name: b.name, brand_name: b.brand_name, composition: b.composition,
    strength: b.strength, form: b.form || 'tablet', prescription_required: Boolean(b.prescription_required),
    status: ACTIVE_STATUS.ACTIVE,
  });
  return created(res, await db('medicines').where({ id }).first(), 'Medicine added');
});

const setMedicineStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  await db('medicines').where({ id: req.params.id }).update({ status });
  return ok(res, { status }, 'Updated');
});

// ---- Orders -----------------------------------------------------------
const listOrders = asyncHandler(async (req, res) => {
  const q = db('medicine_orders as o').leftJoin('pharmacies as ph', 'ph.id', 'o.pharmacy_id').select('o.*', 'ph.pharmacy_name');
  if (req.query.status) q.andWhere('o.order_status', req.query.status);
  if (req.query.pharmacy_id) q.andWhere('o.pharmacy_id', req.query.pharmacy_id);
  const rows = await q.orderBy('o.id', 'desc').limit(200);
  return ok(res, rows);
});

// ---- Support ----------------------------------------------------------
const listTickets = asyncHandler(async (req, res) => {
  const q = db('support_tickets as t').leftJoin('users as u', 'u.id', 't.user_id').select('t.*', 'u.name as user_name', 'u.mobile as user_mobile');
  if (req.query.status) q.andWhere('t.status', req.query.status);
  const rows = await q.orderBy('t.id', 'desc').limit(200);
  return ok(res, rows);
});

const updateTicket = asyncHandler(async (req, res) => {
  const { status } = req.body;
  await db('support_tickets').where({ id: req.params.id }).update({ status });
  return ok(res, { status }, 'Ticket updated');
});

// ---- Audit logs -------------------------------------------------------
const listAuditLogs = asyncHandler(async (req, res) => {
  const rows = await db('audit_logs as l').leftJoin('users as u', 'u.id', 'l.admin_user_id')
    .select('l.*', 'u.name as admin_name').orderBy('l.id', 'desc').limit(200);
  return ok(res, rows);
});

module.exports = {
  dashboard, listUsers, setUserStatus,
  listPharmacies, pharmacyDetail, reviewPharmacy,
  listBloodRequests, setBloodRequestStatus,
  listAmbulanceRequests, assignAmbulance, addProvider, addAmbulance, listAmbulances,
  createDriver, listDrivers,
  addCategory, addMasterMedicine, setMedicineStatus,
  listOrders, listTickets, updateTicket, listAuditLogs,
};
