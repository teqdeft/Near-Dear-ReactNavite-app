const db = require('../db/knex');
const { ok, created } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notify } = require('../services/notificationService');
const {
  ROLES, DONOR_STATUS, BLOOD_REQUEST_STATUS, MATCH_RESPONSE, NOTIFICATION_TYPE,
} = require('../constants/enums');

// ---- Donor ------------------------------------------------------------

// POST /blood/donor  — become a donor / update donor profile
const becomeDonor = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    blood_group, city, pincode, latitude, longitude, last_donation_date,
    is_available = true, can_receive_alerts = true, health_declaration, consent_accepted,
  } = req.body;

  if (!consent_accepted || !health_declaration) {
    throw ApiError.badRequest('Donor consent and self-declaration are required.');
  }

  const existing = await db('donor_profiles').where({ user_id: userId }).first();
  const payload = {
    blood_group, city, pincode, latitude, longitude, last_donation_date,
    is_available: Boolean(is_available), can_receive_alerts: Boolean(can_receive_alerts),
    health_declaration: Boolean(health_declaration), consent_accepted: Boolean(consent_accepted),
    status: DONOR_STATUS.ACTIVE,
  };

  if (existing) {
    await db('donor_profiles').where({ user_id: userId }).update(payload);
  } else {
    await db('donor_profiles').insert({ user_id: userId, ...payload });
  }

  // Promote a plain user to donor role (admin/pharmacy roles are left untouched).
  if (req.user.role === ROLES.USER) {
    await db('users').where({ id: userId }).update({ role: ROLES.DONOR });
  }

  const donor = await db('donor_profiles').where({ user_id: userId }).first();
  return created(res, donor, 'Donor profile saved');
});

// PUT /blood/donor/availability  { is_available }
const setAvailability = asyncHandler(async (req, res) => {
  const donor = await db('donor_profiles').where({ user_id: req.user.id }).first();
  if (!donor) throw ApiError.notFound('You are not registered as a donor');
  const is_available = Boolean(req.body.is_available);
  await db('donor_profiles').where({ user_id: req.user.id }).update({
    is_available,
    status: is_available ? DONOR_STATUS.ACTIVE : DONOR_STATUS.PAUSED,
  });
  return ok(res, { is_available }, is_available ? 'You are now available' : 'Availability paused');
});

// GET /blood/donor/me
const myDonorProfile = asyncHandler(async (req, res) => {
  const donor = await db('donor_profiles').where({ user_id: req.user.id }).first();
  return ok(res, donor || null);
});

// ---- Blood requests ---------------------------------------------------

// POST /blood/requests  — create request + auto-match available donors
const createRequest = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const b = req.body;
  const [id] = await db('blood_requests').insert({
    requester_id: userId,
    patient_name: b.patient_name,
    patient_age: b.patient_age,
    blood_group_required: b.blood_group_required,
    units_required: b.units_required || 1,
    hospital_name: b.hospital_name,
    hospital_address: b.hospital_address,
    city: b.city,
    state: b.state,
    pincode: b.pincode,
    latitude: b.latitude,
    longitude: b.longitude,
    required_at: b.required_at,
    urgency_level: b.urgency_level || 'normal',
    contact_person_name: b.contact_person_name,
    contact_person_mobile: b.contact_person_mobile,
    notes: b.notes,
    status: BLOOD_REQUEST_STATUS.OPEN,
  });

  // Matching: available donors, same blood group, same city, excluding the requester.
  const donors = await db('donor_profiles')
    .where({ blood_group: b.blood_group_required, is_available: true, status: DONOR_STATUS.ACTIVE })
    .whereRaw('LOWER(city) = LOWER(?)', [b.city])
    .andWhere('user_id', '!=', userId);

  for (const donor of donors) {
    // eslint-disable-next-line no-await-in-loop
    await db('blood_request_matches').insert({
      blood_request_id: id,
      donor_user_id: donor.user_id,
      donor_profile_id: donor.id,
      notification_sent: true,
      response_status: MATCH_RESPONSE.PENDING,
    });
    // eslint-disable-next-line no-await-in-loop
    await notify(donor.user_id, {
      title: 'Urgent blood request near you',
      message: `${b.blood_group_required} needed at ${b.hospital_name}, ${b.city}.`,
      type: NOTIFICATION_TYPE.BLOOD,
      referenceId: id,
    });
  }

  if (donors.length) {
    await db('blood_requests').where({ id }).update({ status: BLOOD_REQUEST_STATUS.MATCHED });
  }

  const request = await db('blood_requests').where({ id }).first();
  return created(res, { request, matchedDonors: donors.length }, `Request created. ${donors.length} donor(s) notified.`);
});

// GET /blood/requests/mine
const myRequests = asyncHandler(async (req, res) => {
  const rows = await db('blood_requests').where({ requester_id: req.user.id }).orderBy('id', 'desc');
  return ok(res, rows);
});

// GET /blood/requests/:id  — detail; shares donor contacts only for accepted matches
const requestDetail = asyncHandler(async (req, res) => {
  const request = await db('blood_requests').where({ id: req.params.id }).first();
  if (!request) throw ApiError.notFound('Request not found');
  const isOwner = request.requester_id === req.user.id;
  if (!isOwner && req.user.role !== ROLES.ADMIN) throw ApiError.forbidden();

  const matches = await db('blood_request_matches as m')
    .join('users as u', 'u.id', 'm.donor_user_id')
    .leftJoin('user_profiles as p', 'p.user_id', 'u.id')
    .where('m.blood_request_id', request.id)
    .select(
      'm.id', 'm.response_status', 'm.contact_shared', 'm.responded_at',
      'u.id as donor_user_id', 'u.name as donor_name', 'p.blood_group', 'p.city',
      // Contact only revealed after the donor accepts (compliance rule).
      db.raw('CASE WHEN m.contact_shared = 1 THEN u.mobile ELSE NULL END as donor_mobile')
    );

  return ok(res, { request, matches });
});

// POST /blood/requests/:id/cancel
const cancelRequest = asyncHandler(async (req, res) => {
  const request = await db('blood_requests').where({ id: req.params.id, requester_id: req.user.id }).first();
  if (!request) throw ApiError.notFound('Request not found');
  await db('blood_requests').where({ id: request.id }).update({
    status: BLOOD_REQUEST_STATUS.CANCELLED,
    notes: req.body.reason ? `${request.notes || ''}\nCancelled: ${req.body.reason}` : request.notes,
  });
  return ok(res, null, 'Request cancelled');
});

// POST /blood/requests/:id/fulfill
const fulfillRequest = asyncHandler(async (req, res) => {
  const request = await db('blood_requests').where({ id: req.params.id, requester_id: req.user.id }).first();
  if (!request) throw ApiError.notFound('Request not found');
  await db('blood_requests').where({ id: request.id }).update({ status: BLOOD_REQUEST_STATUS.FULFILLED });
  return ok(res, null, 'Marked as fulfilled');
});

// ---- Donor responses --------------------------------------------------

// GET /blood/donor/requests  — requests this donor was matched to
const donorIncomingRequests = asyncHandler(async (req, res) => {
  const rows = await db('blood_request_matches as m')
    .join('blood_requests as r', 'r.id', 'm.blood_request_id')
    .where('m.donor_user_id', req.user.id)
    .select(
      'm.id as match_id', 'm.response_status', 'm.contact_shared',
      'r.id as request_id', 'r.patient_name', 'r.blood_group_required', 'r.units_required',
      'r.hospital_name', 'r.hospital_address', 'r.city', 'r.urgency_level', 'r.required_at', 'r.status',
      // Requester contact only after the donor accepts.
      db.raw('CASE WHEN m.contact_shared = 1 THEN r.contact_person_name ELSE NULL END as contact_person_name'),
      db.raw('CASE WHEN m.contact_shared = 1 THEN r.contact_person_mobile ELSE NULL END as contact_person_mobile')
    )
    .orderBy('m.id', 'desc');
  return ok(res, rows);
});

// POST /blood/matches/:id/respond  { action: 'accept' | 'decline' }
const respondToMatch = asyncHandler(async (req, res) => {
  const { action } = req.body;
  const match = await db('blood_request_matches').where({ id: req.params.id, donor_user_id: req.user.id }).first();
  if (!match) throw ApiError.notFound('Match not found');
  if (match.response_status !== MATCH_RESPONSE.PENDING) throw ApiError.badRequest('You have already responded');

  const request = await db('blood_requests').where({ id: match.blood_request_id }).first();

  if (action === 'accept') {
    await db('blood_request_matches').where({ id: match.id }).update({
      response_status: MATCH_RESPONSE.ACCEPTED,
      contact_shared: true,
      responded_at: db.fn.now(),
    });
    // Notify the requester that a donor accepted (contact now shared both ways).
    const donorUser = await db('users').where({ id: req.user.id }).first();
    await notify(request.requester_id, {
      title: 'A donor accepted your blood request',
      message: `${donorUser.name || 'A donor'} accepted. You can now contact each other.`,
      type: NOTIFICATION_TYPE.BLOOD,
      referenceId: request.id,
    });
    return ok(res, { contact_shared: true, requester_contact: { name: request.contact_person_name, mobile: request.contact_person_mobile } }, 'Accepted. Contact details shared.');
  }

  if (action === 'decline') {
    await db('blood_request_matches').where({ id: match.id }).update({
      response_status: MATCH_RESPONSE.DECLINED,
      responded_at: db.fn.now(),
    });
    return ok(res, null, 'Declined');
  }

  throw ApiError.badRequest("action must be 'accept' or 'decline'");
});

module.exports = {
  becomeDonor, setAvailability, myDonorProfile,
  createRequest, myRequests, requestDetail, cancelRequest, fulfillRequest,
  donorIncomingRequests, respondToMatch,
};
