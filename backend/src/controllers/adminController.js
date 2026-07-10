const bcrypt = require('bcryptjs');
const db = require('../db/knex');
const config = require('../config');
const { ok, created } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notify } = require('../services/notificationService');
const { logAction } = require('../services/auditService');
const { expireStaleBloodRequests } = require('../services/bloodRequestService');
const {
  ROLES, USER_STATUS, PHARMACY_APPROVAL, AMBULANCE_STATUS,
  SUPPORT_STATUS, NOTIFICATION_TYPE, ACTIVE_STATUS, AMBULANCE_APPROVAL, DOC_STATUS,
  AADHAAR_KYC_STATUS,
} = require('../constants/enums');

const ip = (req) => req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
const fileUrl = (p) => (p ? `${config.appUrl}/api/v1/files/${p}` : null);

// GET /admin/dashboard
const dashboard = asyncHandler(async (req, res) => {
  // Retire any blood requests past their 10-day window before counting, so the
  // "active blood requests" tile never includes long-dead ones.
  await expireStaleBloodRequests();
  const count = async (table, where = {}) => Number((await db(table).where(where).count('* as c').first()).c);
  // These counts are independent — run them concurrently instead of serially.
  const [
    users, donors, openBlood, matchedBlood, pendingPharmacies,
    medicineOrders, ambulanceRequests, openTickets,
  ] = await Promise.all([
    // Every registered app user except admins (donors, pharmacy owners and
    // drivers are all users who happen to have taken on a role).
    db('users').whereNot('role', ROLES.ADMIN).count('* as c').first().then((r) => Number(r.c)),
    // Donors whose account still exists (exclude deleted users' leftover profiles).
    db('donor_profiles as d').join('users as u', 'u.id', 'd.user_id')
      .whereNot('u.status', USER_STATUS.DELETED).count('* as c').first().then((r) => Number(r.c)),
    count('blood_requests', { status: 'open' }),
    count('blood_requests', { status: 'matched' }),
    count('pharmacies', { approval_status: PHARMACY_APPROVAL.PENDING }),
    count('medicine_orders'),
    count('ambulance_requests'),
    count('support_tickets', { status: SUPPORT_STATUS.OPEN }),
  ]);
  return ok(res, {
    users,
    donors,
    active_blood_requests: openBlood + matchedBlood,
    pending_pharmacies: pendingPharmacies,
    medicine_orders: medicineOrders,
    ambulance_requests: ambulanceRequests,
    open_tickets: openTickets,
  });
});

// ---- Users ------------------------------------------------------------
const listUsers = asyncHandler(async (req, res) => {
  const { search, role, page = 1, limit = 20 } = req.query;
  const q = db('users').whereNot('role', ROLES.ADMIN);
  if (role) q.andWhere('role', role);
  if (search) q.andWhere((b) => b.whereILike('name', `%${search}%`).orWhereILike('mobile', `%${search}%`));
  const offset = (Number(page) - 1) * Number(limit);
  const rows = await q.clone().select('id', 'name', 'mobile', 'email', 'role', 'status', 'aadhaar_kyc_status', 'deletion_requested_at', 'created_at')
    .orderBy('id', 'desc').limit(Number(limit)).offset(offset);
  const total = Number((await q.clone().count('* as c').first()).c);
  return ok(res, { items: rows, total, page: Number(page), limit: Number(limit) });
});

// DELETE /admin/users/:id  — permanently delete a user and ALL their data
// (right to erasure). Related rows are removed/nulled by the DB via CASCADE /
// SET NULL foreign keys, so the user's owned data (profile, addresses, their
// requests, orders, prescriptions, notifications) is deleted and references from
// other records are cleared.
const deleteUser = asyncHandler(async (req, res) => {
  const user = await db('users').where({ id: req.params.id }).first();
  if (!user) throw ApiError.notFound('User not found');
  if (user.role === ROLES.ADMIN) throw ApiError.forbidden('Admin accounts cannot be deleted here');

  await db('users').where({ id: user.id }).del();
  await logAction(req.user.id, {
    action: 'user_deleted', entityType: 'user', entityId: user.id,
    oldValue: { name: user.name, mobile: user.mobile }, newValue: null, ip: ip(req),
  });
  return ok(res, { id: user.id }, 'User account and all their data permanently deleted');
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
  // Bound the result so the table can't return unbounded rows; callers can page
  // via ?page= while the response stays a plain array.
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const offset = (Math.max(1, Number(req.query.page) || 1) - 1) * limit;
  const rows = await q.orderBy('id', 'desc').limit(limit).offset(offset);
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

  // An approved pharmacy must be SUSPENDED (not re-rejected) to be disabled;
  // block redundant/invalid re-decisions on an already-settled record.
  const PHARMACY_TRANSITIONS = {
    [PHARMACY_APPROVAL.PENDING]: [PHARMACY_APPROVAL.APPROVED, PHARMACY_APPROVAL.REJECTED],
    [PHARMACY_APPROVAL.APPROVED]: [PHARMACY_APPROVAL.SUSPENDED],
    [PHARMACY_APPROVAL.SUSPENDED]: [PHARMACY_APPROVAL.APPROVED, PHARMACY_APPROVAL.REJECTED],
    [PHARMACY_APPROVAL.REJECTED]: [PHARMACY_APPROVAL.APPROVED],
  };
  if (!(PHARMACY_TRANSITIONS[pharmacy.approval_status] || []).includes(status)) {
    throw ApiError.conflict(`Cannot change a ${pharmacy.approval_status} pharmacy to ${status}.`);
  }

  await db('pharmacies').where({ id: pharmacy.id }).update({
    approval_status: status,
    rejection_reason: status === PHARMACY_APPROVAL.REJECTED ? (reason || 'Rejected') : null,
    approved_by: req.user.id,
    approved_at: status === PHARMACY_APPROVAL.APPROVED ? db.fn.now() : null,
  });

  // Keep the pharmacy's documents in sync with the decision so their status
  // matches in the admin panel and the pharmacy panel instead of staying
  // "pending". (Suspension is operational — it leaves the docs untouched.)
  if (status === PHARMACY_APPROVAL.APPROVED || status === PHARMACY_APPROVAL.REJECTED) {
    await db('pharmacy_documents').where({ pharmacy_id: pharmacy.id }).update({
      status: status === PHARMACY_APPROVAL.APPROVED ? DOC_STATUS.APPROVED : DOC_STATUS.REJECTED,
    });
  }
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

// ---- Ambulance vehicles (driver self-registered, need approval) -------
// GET /admin/ambulance-vehicles?status=
const listAmbulanceVehicles = asyncHandler(async (req, res) => {
  const q = db('ambulances as a')
    .leftJoin('users as u', 'u.id', 'a.driver_user_id')
    .select('a.*', 'u.name as driver_name', 'u.mobile as driver_mobile')
    .whereNotNull('a.driver_user_id'); // self-registered vehicles only
  if (req.query.status) q.andWhere('a.approval_status', req.query.status);
  const rows = await q.orderBy('a.id', 'desc');
  return ok(res, rows);
});

// GET /admin/ambulance-vehicles/:id
const ambulanceVehicleDetail = asyncHandler(async (req, res) => {
  const vehicle = await db('ambulances as a')
    .leftJoin('users as u', 'u.id', 'a.driver_user_id')
    .where('a.id', req.params.id)
    .select('a.*', 'u.name as driver_name', 'u.mobile as driver_mobile', 'u.aadhaar_kyc_status')
    .first();
  if (!vehicle) throw ApiError.notFound('Vehicle not found');
  const documents = await db('ambulance_documents').where({ ambulance_id: vehicle.id }).orderBy('id', 'desc');
  return ok(res, { vehicle, documents });
});

// PUT /admin/ambulance-vehicles/:id/review  { status, reason? }
const reviewAmbulanceVehicle = asyncHandler(async (req, res) => {
  const { status, reason } = req.body; // approved | rejected
  if (![AMBULANCE_APPROVAL.APPROVED, AMBULANCE_APPROVAL.REJECTED].includes(status)) {
    throw ApiError.badRequest('Invalid approval status');
  }
  const vehicle = await db('ambulances').where({ id: req.params.id }).first();
  if (!vehicle) throw ApiError.notFound('Vehicle not found');

  // Block redundant/invalid re-decisions (e.g. approving an already-approved
  // vehicle again, which would re-fire the notification).
  const VEHICLE_TRANSITIONS = {
    [AMBULANCE_APPROVAL.PENDING]: [AMBULANCE_APPROVAL.APPROVED, AMBULANCE_APPROVAL.REJECTED],
    [AMBULANCE_APPROVAL.APPROVED]: [AMBULANCE_APPROVAL.REJECTED],
    [AMBULANCE_APPROVAL.REJECTED]: [AMBULANCE_APPROVAL.APPROVED],
  };
  if (!(VEHICLE_TRANSITIONS[vehicle.approval_status] || []).includes(status)) {
    throw ApiError.conflict(`Cannot change a ${vehicle.approval_status} vehicle to ${status}.`);
  }

  await db('ambulances').where({ id: vehicle.id }).update({
    approval_status: status,
    rejection_reason: status === AMBULANCE_APPROVAL.REJECTED ? (reason || 'Rejected') : null,
    approved_by: req.user.id,
    approved_at: status === AMBULANCE_APPROVAL.APPROVED ? db.fn.now() : null,
    // An approved ambulance becomes available; a rejected one stays inactive.
    status: status === AMBULANCE_APPROVAL.APPROVED ? 'available' : 'inactive',
  });

  // Keep the driver's documents (e.g. driving license) in sync with the
  // decision, so the same approved/rejected status shows in the admin panel
  // and the driver app instead of staying stuck on "pending".
  await db('ambulance_documents').where({ ambulance_id: vehicle.id }).update({
    status: status === AMBULANCE_APPROVAL.APPROVED ? DOC_STATUS.APPROVED : DOC_STATUS.REJECTED,
  });
  await logAction(req.user.id, { action: `ambulance_${status}`, entityType: 'ambulance', entityId: vehicle.id, oldValue: { status: vehicle.approval_status }, newValue: { status }, ip: ip(req) });
  if (vehicle.driver_user_id) {
    await notify(vehicle.driver_user_id, {
      title: `Ambulance ${status}`,
      message: status === AMBULANCE_APPROVAL.APPROVED
        ? 'Your ambulance is approved. You can now accept rides.'
        : `Your ambulance was rejected. ${reason || ''}`.trim(),
      type: NOTIFICATION_TYPE.ADMIN,
      referenceId: vehicle.id,
    });
  }
  return ok(res, { status }, `Ambulance ${status}`);
});

// ---- Aadhaar manual KYC (users upload card photos → admin verifies) ---
// GET /admin/aadhaar?status=
const listAadhaarSubmissions = asyncHandler(async (req, res) => {
  const q = db('aadhaar_kyc_submissions as s')
    .join('users as u', 'u.id', 's.user_id')
    .select('s.id', 's.status', 's.rejection_reason', 's.created_at', 's.reviewed_at',
      's.user_id', 'u.name as user_name', 'u.mobile as user_mobile', 'u.email as user_email',
      'u.aadhaar_kyc_status');
  if (req.query.status) q.andWhere('s.status', req.query.status);
  const rows = await q.orderBy('s.id', 'desc').limit(200);
  return ok(res, rows);
});

// GET /admin/aadhaar/:id
const aadhaarSubmissionDetail = asyncHandler(async (req, res) => {
  const submission = await db('aadhaar_kyc_submissions as s')
    .join('users as u', 'u.id', 's.user_id')
    .where('s.id', req.params.id)
    .select('s.*', 'u.name as user_name', 'u.mobile as user_mobile', 'u.email as user_email',
      'u.aadhaar_kyc_status')
    .first();
  if (!submission) throw ApiError.notFound('Submission not found');
  return ok(res, {
    ...submission,
    front_url_full: fileUrl(submission.front_url),
    back_url_full: fileUrl(submission.back_url),
  });
});

// PUT /admin/aadhaar/:id/review  { status: approved | rejected, reason? }
const reviewAadhaarSubmission = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  if (!['approved', 'rejected'].includes(status)) throw ApiError.badRequest('Invalid review status');
  const submission = await db('aadhaar_kyc_submissions').where({ id: req.params.id }).first();
  if (!submission) throw ApiError.notFound('Submission not found');

  // Only a pending submission can be decided — block re-deciding a settled one.
  if (submission.status !== 'pending') {
    throw ApiError.conflict(`This submission was already ${submission.status}.`);
  }

  await db('aadhaar_kyc_submissions').where({ id: submission.id }).update({
    status,
    rejection_reason: status === 'rejected' ? (reason || 'Rejected') : null,
    reviewed_by: req.user.id,
    reviewed_at: db.fn.now(),
  });

  await db('users').where({ id: submission.user_id }).update({
    aadhaar_kyc_status: status === 'approved' ? AADHAAR_KYC_STATUS.VERIFIED : AADHAAR_KYC_STATUS.FAILED,
    aadhaar_verified_at: status === 'approved' ? db.fn.now() : null,
  });

  await logAction(req.user.id, {
    action: `aadhaar_${status}`, entityType: 'aadhaar_submission', entityId: submission.id,
    oldValue: { status: submission.status }, newValue: { status }, ip: ip(req),
  });
  await notify(submission.user_id, {
    title: status === 'approved' ? 'Aadhaar verified' : 'Aadhaar verification failed',
    message: status === 'approved'
      ? 'Your Aadhaar has been verified successfully. Your account is now verified.'
      : `Your Aadhaar verification was rejected. ${reason || 'Please re-upload clear photos of your Aadhaar card.'}`.trim(),
    type: NOTIFICATION_TYPE.ADMIN,
    referenceId: submission.id,
  });
  return ok(res, { status }, `Aadhaar ${status}`);
});

// ---- Blood requests ---------------------------------------------------
const listBloodRequests = asyncHandler(async (req, res) => {
  await expireStaleBloodRequests();
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

// ---- Blood donors -----------------------------------------------------
// GET /admin/blood-donors?available=true  — registered donors (optionally only
// the ones currently available to donate), so the dashboard "Donors" tile can
// drill into who's an active donor right now.
const listDonors = asyncHandler(async (req, res) => {
  const q = db('donor_profiles as d')
    .join('users as u', 'u.id', 'd.user_id')
    // Deleted accounts are no longer real users — never list them as donors.
    .whereNot('u.status', USER_STATUS.DELETED)
    .select('d.id', 'd.user_id', 'u.name', 'u.mobile', 'd.blood_group', 'd.city',
      'd.is_available', 'd.status', 'd.last_donation_date', 'd.created_at');
  // "Active" = a live (non-blocked) account that is available and an active donor.
  if (req.query.available === 'true') {
    q.andWhere('u.status', USER_STATUS.ACTIVE).andWhere('d.is_available', true).andWhere('d.status', 'active');
  }
  const rows = await q.orderBy('d.id', 'desc').limit(300);
  return ok(res, rows);
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
  // Can't (re)assign a trip that's already done or cancelled.
  if ([AMBULANCE_STATUS.COMPLETED, AMBULANCE_STATUS.CANCELLED].includes(r.status)) {
    throw ApiError.conflict(`This request is already ${r.status} and cannot be assigned.`);
  }

  let driverId = driver_user_id || null;
  if (ambulance_id) {
    const amb = await db('ambulances').where({ id: ambulance_id }).first();
    if (!amb) throw ApiError.notFound('Ambulance not found');
    // Don't hand out an ambulance that's already on another trip.
    if (amb.status === 'busy') throw ApiError.conflict('That ambulance is already busy on another trip.');
    if (!driverId) driverId = amb.driver_user_id;
  }

  // A driver can run only one trip at a time — reject if they're already busy
  // on a different request (mirrors the DB lock uq_amb_one_active_trip_per_driver).
  if (driverId) {
    const busy = await db('ambulance_requests')
      .where({ assigned_driver_id: driverId })
      .whereNot({ id: r.id })
      .whereIn('status', [AMBULANCE_STATUS.ASSIGNED, AMBULANCE_STATUS.ACCEPTED, AMBULANCE_STATUS.ON_THE_WAY, AMBULANCE_STATUS.PICKED_UP])
      .first();
    if (busy) throw ApiError.conflict('That driver already has an active trip.');
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
  // Paginated — the order list grows unbounded, so never return it all at once.
  const q = db('medicine_orders as o').leftJoin('pharmacies as ph', 'ph.id', 'o.pharmacy_id');
  if (req.query.status) q.andWhere('o.order_status', req.query.status);
  if (req.query.pharmacy_id) q.andWhere('o.pharmacy_id', req.query.pharmacy_id);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const page = Math.max(1, Number(req.query.page) || 1);
  const rows = await q.clone().select('o.*', 'ph.pharmacy_name')
    .orderBy('o.id', 'desc').limit(limit).offset((page - 1) * limit);
  const total = Number((await q.clone().count('o.id as c').first()).c);
  return ok(res, { items: rows, total, page, limit });
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
  dashboard, listUsers, setUserStatus, deleteUser,
  listPharmacies, pharmacyDetail, reviewPharmacy,
  listAmbulanceVehicles, ambulanceVehicleDetail, reviewAmbulanceVehicle,
  listAadhaarSubmissions, aadhaarSubmissionDetail, reviewAadhaarSubmission,
  listBloodRequests, setBloodRequestStatus, listDonors,
  listAmbulanceRequests, assignAmbulance, addProvider, addAmbulance, listAmbulances,
  createDriver, listDrivers,
  addCategory, addMasterMedicine, setMedicineStatus,
  listOrders, listTickets, updateTicket, listAuditLogs,
};
