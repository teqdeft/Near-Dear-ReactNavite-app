const db = require('../db/knex');
const { ok, created } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notify } = require('../services/notificationService');
const { AMBULANCE_STATUS, NOTIFICATION_TYPE, ROLES } = require('../constants/enums');

// Status transitions a driver/admin may move a request through.
const DRIVER_FLOW = [
  AMBULANCE_STATUS.ACCEPTED,
  AMBULANCE_STATUS.ON_THE_WAY,
  AMBULANCE_STATUS.PICKED_UP,
  AMBULANCE_STATUS.COMPLETED,
  AMBULANCE_STATUS.CANCELLED,
];

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

  // Notify nearby drivers — first driver to accept handles the trip.
  const drivers = await findNearbyDrivers(b.city);
  for (const d of drivers) {
    // eslint-disable-next-line no-await-in-loop
    await notify(d.id, {
      title: 'New ambulance request near you',
      message: `${b.patient_name} needs a ${b.ambulance_type || 'any'} ambulance${b.city ? ' in ' + b.city : ''}. Tap to accept.`,
      type: NOTIFICATION_TYPE.AMBULANCE,
      referenceId: id,
    });
  }
  // Also keep admins informed.
  const admins = await db('users').where({ role: ROLES.ADMIN }).select('id');
  for (const a of admins) {
    // eslint-disable-next-line no-await-in-loop
    await notify(a.id, {
      title: 'New ambulance request',
      message: `${b.patient_name} needs an ambulance (${b.ambulance_type || 'any'}).`,
      type: NOTIFICATION_TYPE.AMBULANCE,
      referenceId: id,
    });
  }

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
  const id = req.params.id;
  const request = await db('ambulance_requests').where({ id }).first();
  if (!request) throw ApiError.notFound('Request not found');
  if (request.assigned_driver_id) throw ApiError.conflict('This request was already accepted by another driver');
  if (request.status !== AMBULANCE_STATUS.REQUESTED) throw ApiError.badRequest('This request can no longer be accepted');

  // Atomic claim: only succeeds if still unassigned.
  const claimed = await db('ambulance_requests')
    .where({ id, status: AMBULANCE_STATUS.REQUESTED })
    .whereNull('assigned_driver_id')
    .update({ assigned_driver_id: req.user.id, status: AMBULANCE_STATUS.ACCEPTED });
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

  await db('ambulance_requests').where({ id: r.id }).update({ status });
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
};
