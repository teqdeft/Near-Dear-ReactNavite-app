const db = require('../db/knex');
const config = require('../config');
const { ok, created } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notify, notifyMany } = require('../services/notificationService');
const { requireKyc } = require('../utils/requireKyc');
const { citiesOverlap } = require('../utils/cityMatch');
const { distanceKm, toCoord } = require('../utils/geo');
const { renameUpload } = require('../utils/fileNaming');
const { AMBULANCE_STATUS_COPY } = require('../utils/notificationCopy');
const {
  AMBULANCE_STATUS, NOTIFICATION_TYPE, ROLES, USER_STATUS,
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
  // Save under the driver's name + vehicle number + document type for easy
  // tracking (e.g. "ramesh-kumar_pb10ab1234_driving-license_<time>.jpg").
  const relPath = renameUpload(req.file, 'ambulance_docs', [req.user.name, vehicle.vehicle_number, documentType]);

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
    // No city here: `ambulances` has no city column — a driver's coverage lives on
    // their profile, not the vehicle.
    await notifyMany(admins.map((a) => a.id), {
      title: '📋 New ambulance awaiting approval',
      message: `${vehicle.vehicle_number} (${vehicle.ambulance_type || 'basic'}) was registered. Review the documents to approve it — the driver cannot take rides until you do.`,
      type: NOTIFICATION_TYPE.ADMIN,
      referenceId: vehicle.id,
    });
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

// How far from the pickup a driver can be and still be worth waking. In an
// emergency the cost of alerting a driver who turns out to be slightly too far
// is nothing next to the cost of alerting nobody.
const DRIVER_RADIUS_KM = 10;

/**
 * How recent a driver's location must be to be believed. An ambulance that last
 * pinged 30 minutes ago could be two towns away — that coordinate is not a
 * location, it's a memory.
 *
 * The age is computed in SQL, never in JS. MySQL hands back a naive datetime
 * string ("2026-07-13 09:03:45") with no zone, and `new Date(...)` reads that as
 * LOCAL time — so on an IST machine every location silently looked 5.5 hours
 * stale and the radius never fired at all. Doing the arithmetic in the database
 * keeps the write (NOW()) and the read (TIMESTAMPDIFF against NOW()) on one
 * clock, with no zone to get wrong.
 */
const LOCATION_FRESH_SECONDS = 5 * 60;
const LOCATION_AGE_SQL = 'TIMESTAMPDIFF(SECOND, l.updated_at, NOW())';

/**
 * Drivers to notify about a request.
 *
 * Two rules decide who is "near", and it is a UNION — either alone is enough:
 *
 *   1. their service city overlaps the request's city (what we have always done), OR
 *   2. their last known location is within DRIVER_RADIUS_KM of the pickup AND that
 *      location is fresh.
 *
 * The direction of the union is the whole safety argument. Rule 2 only ever ADDS
 * drivers — the one parked 4 km away in a town they never listed, whom city
 * matching misses. It must never remove one: a driver who is off duty, denied GPS,
 * or whose phone is asleep has to keep receiving city-matched requests exactly as
 * before. Narrowing an emergency dispatch to "whoever happened to be sharing GPS"
 * would not be a feature, it would be a regression that costs lives.
 *
 * Separately, every driver here must actually be ABLE to take the trip. Each check
 * mirrors one acceptRequest enforces, and they must stay in step — a driver we
 * notify but who is then refused gets an emergency alert they can do nothing about,
 * and the booking user is told "3 drivers notified" when the number who can come is
 * zero. That false comfort is the real harm.
 *
 *   - approved ambulance -> acceptRequest 403s without one
 *   - no live trip       -> acceptRequest 409s; an ambulance carries one patient
 *
 * `ambulances.status` is deliberately NOT the busy check: it is derived state that
 * can drift. The live-trip lookup is the same source of truth as the DB lock
 * `uq_amb_one_active_trip_per_driver`.
 */
async function findNearbyDrivers(city, pickup) {
  const pickupCoord = toCoord(pickup?.latitude, pickup?.longitude);
  if (!city && !pickupCoord) return []; // nothing to match on at all

  // Everyone who could take a trip right now. Deliberately NOT narrowed by city in
  // SQL: a driver 4 km away in a town they never listed still qualifies on distance,
  // and a city WHERE clause would drop them before we ever measured.
  const candidates = await db('users as u')
    .join('user_profiles as p', 'p.user_id', 'u.id')
    .join('ambulances as a', 'a.driver_user_id', 'u.id')
    .leftJoin('driver_locations as l', 'l.driver_user_id', 'u.id')
    .where('u.role', ROLES.AMBULANCE_DRIVER)
    .andWhere('u.status', USER_STATUS.ACTIVE)
    .andWhere('a.approval_status', AMBULANCE_APPROVAL.APPROVED)
    .whereNotExists(function liveTrip() {
      this.select('*').from('ambulance_requests as r')
        .whereRaw('r.assigned_driver_id = u.id')
        .whereIn('r.status', DRIVER_BUSY_STATUSES);
    })
    .select(
      'u.id', 'p.city',
      'l.latitude as driver_latitude', 'l.longitude as driver_longitude',
      'l.is_on_duty as is_on_duty',
      db.raw(`${LOCATION_AGE_SQL} as location_age_seconds`)
    )
    .groupBy('u.id', 'p.city', 'l.latitude', 'l.longitude', 'l.is_on_duty', 'l.updated_at');

  const matched = candidates.filter((d) => {
    if (city && citiesOverlap(city, d.city)) return true; // rule 1
    if (!pickupCoord) return false;

    // Only an on-duty driver is pinging, so an off-duty row is a leftover from
    // their last shift: a real coordinate that means nothing now.
    if (!d.is_on_duty) return false;
    const age = d.location_age_seconds;
    if (age == null || age < 0 || age > LOCATION_FRESH_SECONDS) return false;

    const km = distanceKm(pickup, { latitude: d.driver_latitude, longitude: d.driver_longitude });
    return km !== null && km <= DRIVER_RADIUS_KM; // rule 2
  });

  return matched.map((d) => ({ id: d.id }));
}

// POST /ambulance/requests
const createRequest = asyncHandler(async (req, res) => {
  requireKyc(req, 'book an ambulance');
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
    findNearbyDrivers(b.city, { latitude: b.pickup_latitude, longitude: b.pickup_longitude }),
    db('users').where({ role: ROLES.ADMIN }).select('id'),
  ]);
  const ambType = b.ambulance_type && b.ambulance_type !== 'any' ? `${b.ambulance_type.toUpperCase()} ambulance` : 'ambulance';
  await Promise.all([
    // A driver decides from the lock screen whether this ride is theirs, so the
    // pickup address goes in — it is the one fact that settles it. Without it they
    // must open the app just to find out the pickup is across town.
    notifyMany(drivers.map((d) => d.id), {
      title: '🚨 New ambulance request near you',
      message: `${b.patient_name} needs an ${ambType}. Pickup: ${b.pickup_address}${b.city ? `, ${b.city}` : ''}. Tap to accept.`,
      type: NOTIFICATION_TYPE.AMBULANCE,
      referenceId: id,
    }),
    notifyMany(admins.map((a) => a.id), {
      title: '🚨 New ambulance request',
      message: `${b.patient_name} needs an ${ambType} at ${b.pickup_address}${b.city ? `, ${b.city}` : ''}. ${drivers.length} driver${drivers.length === 1 ? '' : 's'} notified.`,
      type: NOTIFICATION_TYPE.AMBULANCE,
      referenceId: id,
    }),
    // The requester is in an emergency and is about to stare at the screen. Say
    // whether help is actually coming — and if no driver was reachable, say THAT,
    // loudly, so they call 108 instead of waiting on a dispatch that isn't coming.
    notify(req.user.id, drivers.length
      ? {
        title: `🚑 ${drivers.length} driver${drivers.length > 1 ? 's' : ''} alerted`,
        message: `We've alerted ${drivers.length} nearby ambulance driver${drivers.length > 1 ? 's' : ''}. You'll be notified the moment one accepts — keep your phone reachable on ${b.contact_mobile}.`,
        type: NOTIFICATION_TYPE.AMBULANCE,
        referenceId: id,
      }
      : {
        title: '⚠️ No drivers available right now',
        message: 'No ambulance driver is on duty near you at the moment. Our team has been alerted and will assign one manually — but if this is life-threatening, please call 108 now.',
        type: NOTIFICATION_TYPE.AMBULANCE,
        referenceId: id,
      }),
  ]);

  const request = await db('ambulance_requests').where({ id }).first();
  // The count is now the number of drivers who can actually come, so it is safe
  // to show. Zero is not a failure — admins were notified and assign manually —
  // but the user must not be left thinking help is already on its way.
  const message = drivers.length
    ? `Request sent. ${drivers.length} nearby driver(s) notified.`
    : 'Request sent. No driver is free nearby right now — our team has been alerted and will assign an ambulance.';
  return created(res, { ...request, notifiedDrivers: drivers.length }, message);
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

  // A driver who has already accepted is, right now, driving to a pickup that no
  // longer exists. Freeing their ambulance row above lets the SYSTEM give them
  // work again, but says nothing to the DRIVER — without this they arrive at the
  // address and find nobody there.
  if (r.assigned_driver_id) {
    await notify(r.assigned_driver_id, {
      title: '🚫 Ride cancelled',
      message: `${r.patient_name} cancelled the pickup at ${r.pickup_address}. Please stand down — you're free to accept new requests.`,
      type: NOTIFICATION_TYPE.AMBULANCE,
      referenceId: r.id,
    });
  }

  return ok(res, null, 'Request cancelled');
});

// ---- Driver duty & location -------------------------------------------

// Write the driver's row in driver_locations, creating it on first use.
async function upsertDriverLocation(driverUserId, patch) {
  const existing = await db('driver_locations').where({ driver_user_id: driverUserId }).first();
  if (existing) {
    await db('driver_locations').where({ driver_user_id: driverUserId }).update(patch);
  } else {
    await db('driver_locations').insert({ driver_user_id: driverUserId, ...patch });
  }
  return db('driver_locations').where({ driver_user_id: driverUserId }).first();
}

// GET /ambulance/driver/duty — is this driver on duty, and where were they last?
const driverDuty = asyncHandler(async (req, res) => {
  const row = await db('driver_locations').where({ driver_user_id: req.user.id }).first();
  return ok(res, { is_on_duty: !!row?.is_on_duty, updated_at: row?.updated_at || null });
});

/**
 * PUT /ambulance/driver/duty  { on_duty: boolean }
 *
 * The driver's own switch. Going off duty CLEARS the stored coordinate rather
 * than just flipping the flag: we have no business keeping a record of where a
 * driver was once they have stopped working, and a lingering coordinate is one
 * bad query away from dispatching to someone who went home an hour ago.
 */
const setDriverDuty = asyncHandler(async (req, res) => {
  const onDuty = Boolean(req.body?.on_duty);
  const patch = onDuty
    ? { is_on_duty: true, updated_at: db.fn.now() }
    : { is_on_duty: false, latitude: null, longitude: null, updated_at: null };
  const row = await upsertDriverLocation(req.user.id, patch);
  return ok(res, { is_on_duty: !!row.is_on_duty },
    onDuty ? 'You are on duty. Nearby requests will reach you.' : 'You are off duty.');
});

/**
 * POST /ambulance/driver/ping  { latitude, longitude }
 *
 * Where the driver is now. Rejected when they are off duty — the app should not
 * be sending it, and accepting it anyway would let a coordinate outlive the
 * consent that produced it.
 */
const pingDriverLocation = asyncHandler(async (req, res) => {
  const coord = toCoord(req.body?.latitude, req.body?.longitude);
  if (!coord) throw ApiError.badRequest('A valid latitude and longitude are required');

  const row = await db('driver_locations').where({ driver_user_id: req.user.id }).first();
  if (!row?.is_on_duty) throw ApiError.badRequest('Go on duty before sharing your location.');

  await db('driver_locations').where({ driver_user_id: req.user.id })
    .update({ latitude: coord.lat, longitude: coord.lng, updated_at: db.fn.now() });
  return ok(res, null);
});

// ---- Driver views -----------------------------------------------------

// GET /ambulance/driver/requests  — requests assigned to this driver
const driverRequests = asyncHandler(async (req, res) => {
  const rows = await db('ambulance_requests').where({ assigned_driver_id: req.user.id }).orderBy('id', 'desc');
  return ok(res, rows);
});

/**
 * GET /ambulance/driver/available — open requests this driver can accept.
 *
 * The pull-side mirror of findNearbyDrivers, and it MUST mirror it. A driver we
 * alerted on distance would otherwise open the app and find an empty list: the
 * notification says "tap to accept" and there is nothing there to tap. So the
 * same union applies — a request is shown when its city overlaps the driver's,
 * OR its pickup is within DRIVER_RADIUS_KM of where the driver is right now.
 *
 * `distance_km` rides along so the driver can see which call is closest, and is
 * null when either side has no coordinate — never a fabricated zero.
 */
const driverAvailable = asyncHandler(async (req, res) => {
  const profile = await db('user_profiles').where({ user_id: req.user.id }).first();
  const city = profile?.city;

  // Age from SQL, never from a parsed datetime string — see LOCATION_AGE_SQL.
  const loc = await db('driver_locations as l')
    .where({ driver_user_id: req.user.id })
    .select('l.latitude', 'l.longitude', 'l.is_on_duty',
      db.raw(`${LOCATION_AGE_SQL} as location_age_seconds`))
    .first();

  // Only trust the driver's position if they are on duty and it is fresh — the
  // same test the dispatcher applies. A stale pin must not silently widen or
  // narrow what they see.
  const age = loc?.location_age_seconds;
  const fresh = age != null && age >= 0 && age <= LOCATION_FRESH_SECONDS;
  const here = loc && loc.is_on_duty && fresh ? toCoord(loc.latitude, loc.longitude) : null;

  if (!city && !here) return ok(res, []);

  const all = await db('ambulance_requests')
    .where({ status: AMBULANCE_STATUS.REQUESTED })
    .whereNull('assigned_driver_id')
    .orderBy('id', 'desc');

  const mine = all
    .map((r) => {
      const km = here
        ? distanceKm({ latitude: here.lat, longitude: here.lng },
          { latitude: r.pickup_latitude, longitude: r.pickup_longitude })
        : null;
      return { ...r, distance_km: km === null ? null : Math.round(km * 10) / 10 };
    })
    .filter((r) => (city && citiesOverlap(r.city, city))
      || (r.distance_km !== null && r.distance_km <= DRIVER_RADIUS_KM));

  return ok(res, mine);
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

  // Who is coming, in what, and on what number. A requester in an emergency should
  // not have to open an app to find the driver's phone number — this notification
  // is very likely the only thing they will look at.
  const driver = await db('users').where({ id: req.user.id }).first();
  await notify(request.user_id, {
    title: '🚑 Ambulance accepted!',
    message: `${driver?.name || 'A driver'} is coming for ${request.patient_name}${amb?.vehicle_number ? ` in ${amb.vehicle_number}` : ''}.${driver?.mobile ? ` Call them on ${driver.mobile}.` : ''} Track the ambulance live in the app.`,
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

  const copy = AMBULANCE_STATUS_COPY[status];
  if (copy) {
    await notify(r.user_id, { ...copy(r), type: NOTIFICATION_TYPE.AMBULANCE, referenceId: r.id });
  }
  return ok(res, { status }, 'Status updated');
});

// POST /ambulance/requests/:id/release  — the assigned driver drops the trip
// (e.g. accepted by mistake). Instead of cancelling the whole request, it is
// RE-OPENED so nearby drivers can accept it again — the patient still needs an
// ambulance. Only allowed before the patient is picked up.
const RELEASABLE_STATUSES = [AMBULANCE_STATUS.ACCEPTED, AMBULANCE_STATUS.ON_THE_WAY];
const releaseRequest = asyncHandler(async (req, res) => {
  const r = await db('ambulance_requests').where({ id: req.params.id }).first();
  if (!r) throw ApiError.notFound('Request not found');
  if (r.assigned_driver_id !== req.user.id) throw ApiError.forbidden('This trip is not assigned to you');
  if (!RELEASABLE_STATUSES.includes(r.status)) {
    throw ApiError.conflict(`A trip that is "${r.status}" can no longer be released.`);
  }

  // Free the driver's ambulance and re-open the request to the pool.
  if (r.assigned_ambulance_id) {
    await db('ambulances').where({ id: r.assigned_ambulance_id }).update({ status: 'available' });
  }
  await db('ambulance_requests').where({ id: r.id }).update({
    status: AMBULANCE_STATUS.REQUESTED,
    assigned_driver_id: null,
    assigned_ambulance_id: null,
  });

  // Re-notify other nearby drivers (not the one who just released it).
  const drivers = await findNearbyDrivers(r.city, {
    latitude: r.pickup_latitude, longitude: r.pickup_longitude,
  });
  await Promise.all([
    ...drivers.filter((d) => d.id !== req.user.id).map((d) => notify(d.id, {
      title: 'Ambulance request available again',
      message: `${r.patient_name} needs a ${r.ambulance_type || 'any'} ambulance${r.city ? ' in ' + r.city : ''}. Tap to accept.`,
      type: NOTIFICATION_TYPE.AMBULANCE,
      referenceId: r.id,
    })),
    // Reassure the patient that we're finding someone else.
    notify(r.user_id, {
      title: 'Finding another ambulance',
      message: 'The assigned driver couldn’t continue. We’re notifying other nearby drivers for you.',
      type: NOTIFICATION_TYPE.AMBULANCE,
      referenceId: r.id,
    }),
  ]);

  return ok(res, { status: AMBULANCE_STATUS.REQUESTED }, 'Trip released. Nearby drivers have been notified.');
});

module.exports = {
  createRequest, myRequests, requestDetail, cancelRequest,
  driverRequests, driverAvailable, acceptRequest, updateStatus, releaseRequest,
  driverDuty, setDriverDuty, pingDriverLocation,
  updateLocation, trackRequest,
  registerVehicle, myVehicle, uploadVehicleDocument,
};
