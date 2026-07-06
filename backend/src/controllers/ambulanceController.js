const db = require('../db/knex');
const config = require('../config');
const { ok, created } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notify } = require('../services/notificationService');
const { requireKyc } = require('../utils/requireKyc');
const {
  AMBULANCE_STATUS, NOTIFICATION_TYPE, ROLES,
  AMBULANCE_APPROVAL, AMBULANCE_DOC_TYPE, DOC_STATUS, AMBULANCE_TYPE,
} = require('../constants/enums');

const fileUrl = (p) => `${config.appUrl}/api/v1/files/${p}`;

// ---- Driver's own ambulance (vehicle) registration + KYC-style approval ----

// The single ambulance a driver owns (self-registered).
async function driverVehicle(userId) {
  return db('ambulances').where({ driver_user_id: userId }).first();
}

// POST /ambulance/driver/vehicle  { vehicle_number, ambulance_type }
const registerVehicle = asyncHandler(async (req, res) => {
  if (req.user.role !== ROLES.AMBULANCE_DRIVER) throw ApiError.forbidden('Only ambulance drivers can register a vehicle');
  const { vehicle_number, ambulance_type } = req.body;
  if (!vehicle_number || !vehicle_number.trim()) throw ApiError.badRequest('Vehicle number is required');

  const existing = await driverVehicle(req.user.id);
  const patch = {
    vehicle_number: vehicle_number.trim().toUpperCase(),
    ambulance_type: Object.values(AMBULANCE_TYPE).includes(ambulance_type) ? ambulance_type : AMBULANCE_TYPE.BASIC,
  };

  let id;
  if (existing) {
    // Re-submitting details resets it to pending for re-review.
    await db('ambulances').where({ id: existing.id }).update({
      ...patch, approval_status: AMBULANCE_APPROVAL.PENDING, rejection_reason: null,
    });
    id = existing.id;
  } else {
    [id] = await db('ambulances').insert({
      ...patch,
      driver_user_id: req.user.id,
      status: 'inactive',
      approval_status: AMBULANCE_APPROVAL.PENDING,
    });
  }

  // NOTE: admins are notified only once the driver uploads their first
  // document (see uploadVehicleDocument) — a bare vehicle number isn't enough
  // to review.
  const vehicle = await db('ambulances').where({ id }).first();
  return created(res, vehicle, 'Vehicle saved. Upload your documents to submit for approval.');
});

// GET /ambulance/driver/vehicle  — my vehicle + documents
const myVehicle = asyncHandler(async (req, res) => {
  const vehicle = await driverVehicle(req.user.id);
  if (!vehicle) return ok(res, null);
  const documents = await db('ambulance_documents').where({ ambulance_id: vehicle.id }).orderBy('id', 'desc');
  return ok(res, { vehicle, documents: documents.map((d) => ({ ...d, url: fileUrl(d.file_url) })) });
});

// POST /ambulance/driver/vehicle/documents  (multipart: file + document_type)
const uploadVehicleDocument = asyncHandler(async (req, res) => {
  const vehicle = await driverVehicle(req.user.id);
  if (!vehicle) throw ApiError.notFound('Register your vehicle first');
  if (!req.file) throw ApiError.badRequest('A document file is required');
  const documentType = Object.values(AMBULANCE_DOC_TYPE).includes(req.body.document_type)
    ? req.body.document_type : AMBULANCE_DOC_TYPE.OTHER;
  const relPath = `ambulance_docs/${req.file.filename}`;

  const [id] = await db('ambulance_documents').insert({
    ambulance_id: vehicle.id,
    document_type: documentType,
    file_url: relPath,
    status: DOC_STATUS.PENDING,
  });

  // Notify admins once the first document lands — now the vehicle is a real,
  // reviewable registration.
  const [{ c: docCount }] = await db('ambulance_documents').where({ ambulance_id: vehicle.id }).count('* as c');
  if (Number(docCount) === 1) {
    const admins = await db('users').where({ role: ROLES.ADMIN }).select('id');
    await Promise.all(admins.map((a) => notify(a.id, {
      title: 'New ambulance registration',
      message: `A driver registered vehicle ${vehicle.vehicle_number} — awaiting approval.`,
      type: NOTIFICATION_TYPE.ADMIN,
      referenceId: vehicle.id,
    })));
  }

  const doc = await db('ambulance_documents').where({ id }).first();
  return created(res, { ...doc, url: fileUrl(doc.file_url) }, 'Document uploaded');
});

// Status transitions a driver/admin may move a request through.
const DRIVER_FLOW = [
  AMBULANCE_STATUS.ACCEPTED,
  AMBULANCE_STATUS.ON_THE_WAY,
  AMBULANCE_STATUS.PICKED_UP,
  AMBULANCE_STATUS.COMPLETED,
  AMBULANCE_STATUS.CANCELLED,
];

// A driver is "busy" (can't take another trip) in any of these — mirrors the
// DB lock `uq_amb_one_active_trip_per_driver`. Includes 'assigned' so an
// admin-assigned trip also blocks a second one.
const DRIVER_BUSY_STATUSES = [
  AMBULANCE_STATUS.ASSIGNED,
  AMBULANCE_STATUS.ACCEPTED,
  AMBULANCE_STATUS.ON_THE_WAY,
  AMBULANCE_STATUS.PICKED_UP,
];

// Terminal states — once a trip reaches one of these it can't change again.
const TERMINAL_STATUSES = [AMBULANCE_STATUS.COMPLETED, AMBULANCE_STATUS.CANCELLED];

// Forward-only transitions the driver flow allows from each live state.
const STATUS_TRANSITIONS = {
  [AMBULANCE_STATUS.ASSIGNED]: [AMBULANCE_STATUS.ACCEPTED, AMBULANCE_STATUS.ON_THE_WAY, AMBULANCE_STATUS.CANCELLED],
  [AMBULANCE_STATUS.ACCEPTED]: [AMBULANCE_STATUS.ON_THE_WAY, AMBULANCE_STATUS.CANCELLED],
  [AMBULANCE_STATUS.ON_THE_WAY]: [AMBULANCE_STATUS.PICKED_UP, AMBULANCE_STATUS.CANCELLED],
  [AMBULANCE_STATUS.PICKED_UP]: [AMBULANCE_STATUS.COMPLETED, AMBULANCE_STATUS.CANCELLED],
  [AMBULANCE_STATUS.REQUESTED]: [AMBULANCE_STATUS.CANCELLED],
};

// Find nearby drivers: same-city ambulance drivers first, else all active drivers.
async function findNearbyDrivers(city) {
  if (city) {
    const inCity = await db('users as u')
      .join('user_profiles as p', 'p.user_id', 'u.id')
      .where('u.role', ROLES.AMBULANCE_DRIVER)
      .andWhere('u.status', 'active')
      .andWhereRaw('LOWER(p.city) = LOWER(?)', [city])
      .select('u.id');
    if (inCity.length) return inCity;
  }
  return db('users').where({ role: ROLES.AMBULANCE_DRIVER, status: 'active' }).select('id');
}

// POST /ambulance/requests
const createRequest = asyncHandler(async (req, res) => {
  const b = req.body;
  const [id] = await db('ambulance_requests').insert({
    user_id: req.user.id,
    patient_name: b.patient_name,
    contact_mobile: b.contact_mobile,
    pickup_address: b.pickup_address,
    drop_address: b.drop_address,
    city: b.city || null,
    pickup_latitude: b.pickup_latitude,
    pickup_longitude: b.pickup_longitude,
    drop_latitude: b.drop_latitude,
    drop_longitude: b.drop_longitude,
    ambulance_type: b.ambulance_type || 'any',
    notes: b.notes,
    status: AMBULANCE_STATUS.REQUESTED,
  });

  // Notify nearby drivers + admins concurrently — this is a time-critical
  // emergency path, so avoid a serial notify per recipient.
  const [drivers, admins] = await Promise.all([
    findNearbyDrivers(b.city),
    db('users').where({ role: ROLES.ADMIN }).select('id'),
  ]);
  await Promise.all([
    ...drivers.map((d) => notify(d.id, {
      title: 'New ambulance request near you',
      message: `${b.patient_name} needs a ${b.ambulance_type || 'any'} ambulance${b.city ? ' in ' + b.city : ''}. Tap to accept.`,
      type: NOTIFICATION_TYPE.AMBULANCE,
      referenceId: id,
    })),
    ...admins.map((a) => notify(a.id, {
      title: 'New ambulance request',
      message: `${b.patient_name} needs an ambulance (${b.ambulance_type || 'any'}).`,
      type: NOTIFICATION_TYPE.AMBULANCE,
      referenceId: id,
    })),
  ]);

  const request = await db('ambulance_requests').where({ id }).first();
  return created(res, { ...request, notifiedDrivers: drivers.length }, `Request sent. ${drivers.length} nearby driver(s) notified.`);
});

// GET /ambulance/requests/mine
const myRequests = asyncHandler(async (req, res) => {
  const rows = await db('ambulance_requests').where({ user_id: req.user.id }).orderBy('id', 'desc');
  return ok(res, rows);
});

// GET /ambulance/requests/:id
const requestDetail = asyncHandler(async (req, res) => {
  const r = await db('ambulance_requests as r')
    .leftJoin('ambulances as a', 'a.id', 'r.assigned_ambulance_id')
    .leftJoin('users as d', 'd.id', 'r.assigned_driver_id')
    .where('r.id', req.params.id)
    .select('r.*', 'a.vehicle_number', 'd.name as driver_name', 'd.mobile as driver_mobile')
    .first();
  if (!r) throw ApiError.notFound('Request not found');
  if (r.user_id !== req.user.id && req.user.role !== ROLES.ADMIN && r.assigned_driver_id !== req.user.id) {
    throw ApiError.forbidden();
  }
  return ok(res, r);
});

// POST /ambulance/requests/:id/cancel  (by the requesting user)
const cancelRequest = asyncHandler(async (req, res) => {
  const r = await db('ambulance_requests').where({ id: req.params.id, user_id: req.user.id }).first();
  if (!r) throw ApiError.notFound('Request not found');
  if ([AMBULANCE_STATUS.COMPLETED, AMBULANCE_STATUS.CANCELLED].includes(r.status)) {
    throw ApiError.badRequest('Request can no longer be cancelled');
  }
  await db('ambulance_requests').where({ id: r.id }).update({ status: AMBULANCE_STATUS.CANCELLED });
  // Free the assigned ambulance (if any) so the driver can take new requests.
  if (r.assigned_ambulance_id) {
    await db('ambulances').where({ id: r.assigned_ambulance_id }).update({ status: 'available' });
  }
  return ok(res, null, 'Request cancelled');
});

// ---- Driver views -----------------------------------------------------

// GET /ambulance/driver/requests  — requests assigned to this driver
const driverRequests = asyncHandler(async (req, res) => {
  const rows = await db('ambulance_requests').where({ assigned_driver_id: req.user.id }).orderBy('id', 'desc');
  return ok(res, rows);
});

// GET /ambulance/driver/available  — open requests a driver can accept (same city first)
const driverAvailable = asyncHandler(async (req, res) => {
  const profile = await db('user_profiles').where({ user_id: req.user.id }).first();
  const city = profile?.city;
  const base = db('ambulance_requests')
    .where({ status: AMBULANCE_STATUS.REQUESTED })
    .whereNull('assigned_driver_id');
  let rows = city ? await base.clone().andWhereRaw('LOWER(city) = LOWER(?)', [city]).orderBy('id', 'desc') : [];
  // If none in the driver's city (or city unknown), show all open requests.
  if (!rows.length) rows = await base.clone().orderBy('id', 'desc');
  return ok(res, rows);
});

// POST /ambulance/requests/:id/accept  — first driver to accept takes the trip
const acceptRequest = asyncHandler(async (req, res) => {
  requireKyc(req, 'accept ambulance rides');
  const vehicle = await driverVehicle(req.user.id);
  if (!vehicle || vehicle.approval_status !== AMBULANCE_APPROVAL.APPROVED) {
    throw ApiError.forbidden('Your ambulance must be approved by admin before you can accept rides.');
  }
  const id = req.params.id;

  // A driver can run only ONE trip at a time — an ambulance can carry a single
  // patient. Block a new accept while any earlier trip is still live.
  const activeTrip = await db('ambulance_requests')
    .where({ assigned_driver_id: req.user.id })
    .whereIn('status', DRIVER_BUSY_STATUSES)
    .first();
  if (activeTrip) {
    throw ApiError.conflict('You already have an active trip. Complete or cancel it before accepting another.');
  }

  const request = await db('ambulance_requests').where({ id }).first();
  if (!request) throw ApiError.notFound('Request not found');
  if (request.assigned_driver_id) throw ApiError.conflict('This request was already accepted by another driver');
  if (request.status !== AMBULANCE_STATUS.REQUESTED) throw ApiError.badRequest('This request can no longer be accepted');

  // Atomic claim: only succeeds if still unassigned. The unique index
  // `uq_amb_one_active_trip_per_driver` also makes this airtight against two
  // simultaneous accepts by the same driver — the second write hits a duplicate
  // key (ER_DUP_ENTRY) because the driver already has a live trip.
  let claimed;
  try {
    claimed = await db('ambulance_requests')
      .where({ id, status: AMBULANCE_STATUS.REQUESTED })
      .whereNull('assigned_driver_id')
      .update({ assigned_driver_id: req.user.id, status: AMBULANCE_STATUS.ACCEPTED });
  } catch (e) {
    if (e && (e.code === 'ER_DUP_ENTRY' || e.errno === 1062)) {
      throw ApiError.conflict('You already have an active trip. Complete or cancel it before accepting another.');
    }
    throw e;
  }
  if (!claimed) throw ApiError.conflict('This request was just accepted by another driver');

  // Link the driver's ambulance (if any) and mark it busy.
  const amb = await db('ambulances').where({ driver_user_id: req.user.id }).first();
  if (amb) {
    await db('ambulance_requests').where({ id }).update({ assigned_ambulance_id: amb.id });
    await db('ambulances').where({ id: amb.id }).update({ status: 'busy' });
  }

  await notify(request.user_id, {
    title: 'Ambulance accepted 🚑',
    message: 'A driver accepted your request and will call you shortly.',
    type: NOTIFICATION_TYPE.AMBULANCE,
    referenceId: Number(id),
  });

  return ok(res, { contact_mobile: request.contact_mobile, patient_name: request.patient_name }, 'Accepted. Please call the user to coordinate pickup.');
});

// Statuses during which a trip is "live" and location tracking is allowed.
const LIVE_STATUSES = [
  AMBULANCE_STATUS.ACCEPTED,
  AMBULANCE_STATUS.ON_THE_WAY,
  AMBULANCE_STATUS.PICKED_UP,
];

// POST /ambulance/driver/location  { requestId, latitude, longitude, bearing }
// The assigned driver pushes their current GPS position (short-polling, ~5s).
const updateLocation = asyncHandler(async (req, res) => {
  const { requestId, latitude, longitude, bearing } = req.body;
  if (requestId == null || latitude == null || longitude == null) {
    throw ApiError.badRequest('requestId, latitude and longitude are required');
  }

  const r = await db('ambulance_requests').where({ id: requestId }).first();
  if (!r) throw ApiError.notFound('Request not found');
  if (r.assigned_driver_id !== req.user.id) throw ApiError.forbidden('This trip is not assigned to you');
  if (!LIVE_STATUSES.includes(r.status)) throw ApiError.badRequest('Trip is not active');

  await db('ambulance_requests').where({ id: requestId }).update({
    current_latitude: latitude,
    current_longitude: longitude,
    bearing: bearing == null ? null : bearing,
    location_updated_at: db.fn.now(),
  });
  return ok(res, null, 'Location updated');
});

// GET /ambulance/requests/:id/track
// Lightweight payload the user's map polls every ~5s.
const trackRequest = asyncHandler(async (req, res) => {
  const r = await db('ambulance_requests as r')
    .leftJoin('users as d', 'd.id', 'r.assigned_driver_id')
    .where('r.id', req.params.id)
    .select(
      'r.id', 'r.status', 'r.user_id', 'r.assigned_driver_id',
      'r.pickup_latitude', 'r.pickup_longitude', 'r.drop_latitude', 'r.drop_longitude',
      'r.current_latitude', 'r.current_longitude', 'r.bearing', 'r.location_updated_at',
      'd.name as driver_name', 'd.mobile as driver_mobile',
    )
    .first();
  if (!r) throw ApiError.notFound('Request not found');
  if (r.user_id !== req.user.id && req.user.role !== ROLES.ADMIN && r.assigned_driver_id !== req.user.id) {
    throw ApiError.forbidden();
  }
  return ok(res, r);
});

// PUT /ambulance/requests/:id/status  { status }  (driver or admin)
const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!DRIVER_FLOW.includes(status)) throw ApiError.badRequest('Invalid status');

  const r = await db('ambulance_requests').where({ id: req.params.id }).first();
  if (!r) throw ApiError.notFound('Request not found');
  const isDriver = r.assigned_driver_id === req.user.id;
  if (!isDriver && req.user.role !== ROLES.ADMIN) throw ApiError.forbidden('Not assigned to you');

  // Guard the CURRENT state: a completed/cancelled trip is final, and only
  // forward transitions are allowed (no reviving a cancelled trip to "completed").
  if (TERMINAL_STATUSES.includes(r.status)) {
    throw ApiError.conflict(`This trip is already ${r.status} and can no longer change.`);
  }
  if (!(STATUS_TRANSITIONS[r.status] || []).includes(status)) {
    throw ApiError.conflict(`Cannot change a trip from "${r.status}" to "${status}".`);
  }

  await db('ambulance_requests').where({ id: r.id }).update({ status });

  // Free the linked ambulance once the trip ends so it can take new requests.
  if (TERMINAL_STATUSES.includes(status) && r.assigned_ambulance_id) {
    await db('ambulances').where({ id: r.assigned_ambulance_id }).update({ status: 'available' });
  }

  await notify(r.user_id, {
    title: 'Ambulance update',
    message: `Your ambulance request is now: ${status.replace(/_/g, ' ')}.`,
    type: NOTIFICATION_TYPE.AMBULANCE,
    referenceId: r.id,
  });
  return ok(res, { status }, 'Status updated');
});

module.exports = {
  createRequest, myRequests, requestDetail, cancelRequest,
  driverRequests, driverAvailable, acceptRequest, updateStatus,
  updateLocation, trackRequest,
  registerVehicle, myVehicle, uploadVehicleDocument,
};
