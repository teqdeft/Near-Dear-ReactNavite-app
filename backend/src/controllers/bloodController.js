const db = require('../db/knex');
const { ok, created } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notify, notifyMany } = require('../services/notificationService');
const { expireStaleBloodRequests } = require('../services/bloodRequestService');
const { requireKyc } = require('../utils/requireKyc');
const { citiesOverlap, cityOverlapRaw, normalizeCityList } = require('../utils/cityMatch');
const {
  ROLES, USER_STATUS, DONOR_STATUS, BLOOD_REQUEST_STATUS, MATCH_RESPONSE, NOTIFICATION_TYPE,
} = require('../constants/enums');
const { URGENCY_PREFIX } = require('../utils/notificationCopy');

// Requests still looking for donors.
const ACTIVE_REQUEST_STATUSES = [BLOOD_REQUEST_STATUS.OPEN, BLOOD_REQUEST_STATUS.MATCHED];

/**
 * What a donor is shown when a request matches them — from a new request, or from
 * their own availability turning back on. Both must read identically: the donor
 * cannot tell (and should not care) which of the two brought it to them.
 *
 * A donor decides whether to act straight from the lock screen, so the blood group
 * and the hospital go in — the two facts that settle "is this me, and can I get
 * there". Units and the deadline follow, because "1 unit by tonight" and "4 units
 * by Friday" are different asks.
 */
function donorRequestCopy(r) {
  const units = Number(r.units_required || 1);
  const by = r.required_at
    ? ` by ${new Date(r.required_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`
    : '';

  return {
    title: `${URGENCY_PREFIX[r.urgency_level] || '🩸'} ${r.blood_group_required} blood needed`,
    message: `${units} unit${units > 1 ? 's' : ''} needed at ${r.hospital_name}, ${r.city}${by}. Tap to respond.`,
    type: NOTIFICATION_TYPE.BLOOD,
    referenceId: r.id,
  };
}

// Backfill: when a donor becomes available (freshly registered or toggles ON),
// hook them up to blood requests that are still open in their city + group but
// were created before they were available — otherwise those requests would
// never reach them (matching otherwise only runs at request-creation time).
async function matchOpenRequestsToDonor(donor) {
  if (!donor || !donor.blood_group || !donor.city) return 0;
  if (!donor.is_available || donor.status !== DONOR_STATUS.ACTIVE) return 0;

  // A donor can list several cities they can reach ("Mohali, Kharar"), so match
  // on any shared city. The SQL clause is a recall-safe prefilter; citiesOverlap
  // makes the real, whole-token decision.
  const donorCity = cityOverlapRaw('city', donor.city);
  const candidates = await db('blood_requests')
    .where({ blood_group_required: donor.blood_group })
    .whereIn('status', ACTIVE_REQUEST_STATUSES)
    .whereRaw(donorCity.clause, donorCity.bindings)
    .andWhere('requester_id', '!=', donor.user_id)
    .whereNotExists(function subquery() {
      this.select('*').from('blood_request_matches as m')
        .whereRaw('m.blood_request_id = blood_requests.id')
        .andWhere('m.donor_user_id', donor.user_id);
    });
  const requests = candidates.filter((r) => citiesOverlap(donor.city, r.city));

  if (requests.length === 0) return 0;

  // Batch the match inserts, notifications and the OPEN→MATCHED flip instead of
  // doing three serial DB round-trips per request.
  await db('blood_request_matches').insert(requests.map((r) => ({
    blood_request_id: r.id,
    donor_user_id: donor.user_id,
    donor_profile_id: donor.id,
    notification_sent: true,
    response_status: MATCH_RESPONSE.PENDING,
  })));

  const openIds = requests.filter((r) => r.status === BLOOD_REQUEST_STATUS.OPEN).map((r) => r.id);
  await Promise.all([
    ...requests.map((r) => notify(donor.user_id, donorRequestCopy(r))),
    openIds.length
      ? db('blood_requests').whereIn('id', openIds).update({ status: BLOOD_REQUEST_STATUS.MATCHED })
      : Promise.resolve(),
  ]);
  return requests.length;
}

// Notify every donor matched to a request (used when the requester closes it).
async function notifyMatchedDonors(requestId, payload) {
  const matches = await db('blood_request_matches')
    .where({ blood_request_id: requestId }).select('donor_user_id');
  await notifyMany(matches.map((m) => m.donor_user_id), payload);
}

// Shared accept/decline logic for a match row (used by both the match-id and
// request-id response endpoints).
async function applyMatchResponse({ match, request, action, userId, res }) {
  if (match.response_status !== MATCH_RESPONSE.PENDING) throw ApiError.badRequest('You have already responded');
  // Guard against responding to a request that's already closed (cancelled /
  // fulfilled / expired). Without this, a stale client could accept a dead
  // request via the match endpoint — sharing contact and notifying the
  // requester about a request that no longer needs blood.
  if (!request || !ACTIVE_REQUEST_STATUSES.includes(request.status)) {
    throw ApiError.conflict('This request is no longer open.');
  }

  if (action === 'accept') {
    await db('blood_request_matches').where({ id: match.id }).update({
      response_status: MATCH_RESPONSE.ACCEPTED,
      contact_shared: true,
      responded_at: db.fn.now(),
    });
    const donorUser = await db('users').where({ id: userId }).first();
    await notify(request.requester_id, {
      title: '🎉 A donor accepted!',
      // The donor's number is the whole point of this notification — the requester
      // is standing in a hospital and needs to call someone, not navigate an app to
      // find out they can.
      message: `${donorUser.name || 'A donor'} accepted your ${request.blood_group_required} request at ${request.hospital_name}.${donorUser.mobile ? ` Call them on ${donorUser.mobile}.` : ' Open the app to see their contact.'}`,
      // Requester-facing type so the app opens their request detail, not the
      // donor "requests for me" list (the requester may also be a donor).
      type: NOTIFICATION_TYPE.BLOOD_ACCEPTED,
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
}

// ---- Donor ------------------------------------------------------------

// POST /blood/donor  — become a donor / update donor profile
const becomeDonor = asyncHandler(async (req, res) => {
  requireKyc(req);
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
    blood_group, city: normalizeCityList(city), pincode, latitude, longitude, last_donation_date,
    is_available: Boolean(is_available), can_receive_alerts: Boolean(can_receive_alerts),
    health_declaration: Boolean(health_declaration), consent_accepted: Boolean(consent_accepted),
    status: DONOR_STATUS.ACTIVE,
  };

  if (existing) {
    await db('donor_profiles').where({ user_id: userId }).update(payload);

    // If the donor changed their blood group or city, drop any PENDING matches
    // that no longer qualify — otherwise old matches linger in their "requests
    // for me" list. Accepted/declined matches are kept as history; the backfill
    // below re-adds matches that fit the new profile.
    if (existing.blood_group !== payload.blood_group || existing.city !== payload.city) {
      const pending = await db('blood_request_matches as m')
        .join('blood_requests as r', 'r.id', 'm.blood_request_id')
        .where('m.donor_user_id', userId)
        .andWhere('m.response_status', MATCH_RESPONSE.PENDING)
        .select('m.id', 'r.blood_group_required', 'r.city');
      const staleIds = pending
        .filter((m) => m.blood_group_required !== payload.blood_group || !citiesOverlap(payload.city, m.city))
        .map((m) => m.id);
      if (staleIds.length) await db('blood_request_matches').whereIn('id', staleIds).del();
    }
  } else {
    await db('donor_profiles').insert({ user_id: userId, ...payload });
  }

  // Promote a plain user to donor role (admin/pharmacy roles are left untouched).
  if (req.user.role === ROLES.USER) {
    await db('users').where({ id: userId }).update({ role: ROLES.DONOR });
  }

  const donor = await db('donor_profiles').where({ user_id: userId }).first();
  // Connect this donor to any still-open requests they now qualify for.
  const matched = await matchOpenRequestsToDonor(donor);
  const message = matched
    ? `Donor profile saved. ${matched} open request(s) near you — check your requests.`
    : 'Donor profile saved';
  return created(res, { ...donor, backfilled_requests: matched }, message);
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

  // Turning availability ON backfills any open requests created while paused.
  let matched = 0;
  if (is_available) {
    const donor = await db('donor_profiles').where({ user_id: req.user.id }).first();
    matched = await matchOpenRequestsToDonor(donor);
  }
  const message = is_available
    ? (matched ? `You are now available. ${matched} open request(s) near you.` : 'You are now available')
    : 'Availability paused';
  return ok(res, { is_available, backfilled_requests: matched }, message);
});

// GET /blood/donor/me
const myDonorProfile = asyncHandler(async (req, res) => {
  const donor = await db('donor_profiles').where({ user_id: req.user.id }).first();
  return ok(res, donor || null);
});

// ---- Blood requests ---------------------------------------------------

// POST /blood/requests  — create request + auto-match available donors
const createRequest = asyncHandler(async (req, res) => {
  requireKyc(req);
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

  // Matching: available donors, same blood group, overlapping city — a donor
  // lists every city they can reach ("Mohali, Kharar"), so a request in any one
  // of them reaches them. Excludes the requester.
  const reqCity = cityOverlapRaw('city', b.city);
  const candidates = await db('donor_profiles')
    .where({ blood_group: b.blood_group_required, is_available: true, status: DONOR_STATUS.ACTIVE })
    .whereRaw(reqCity.clause, reqCity.bindings)
    .andWhere('user_id', '!=', userId)
    // Skip donors whose user account is blocked or deleted — a donor profile can
    // outlive its account, and such users must never be matched or notified.
    .whereIn('user_id', db('users').where({ status: USER_STATUS.ACTIVE }).select('id'));
  const donors = candidates.filter((d) => citiesOverlap(b.city, d.city));

  // Read the row back rather than notifying from req.body. donorRequestCopy formats
  // `required_at`, and the two are not the same value: the driver hands back a Date
  // it parsed in the connection's timezone, while req.body carries whatever string
  // the client posted — an ISO 'Z' string would be re-parsed as UTC and rendered
  // hours off. Since the backfill path (matchDonorToOpenRequests) always passes a
  // row, notifying from the body here would give two donors two different deadlines
  // for the same request.
  // Named createdRow, NOT `created` — that would shadow the response helper
  // imported at the top and turn the final `return created(res, ...)` into a
  // "created is not a function" crash after the request was already saved.
  const createdRow = await db('blood_requests').where({ id }).first();

  if (donors.length) {
    // Batch the match inserts + notifications instead of a serial round-trip
    // per donor (this is a time-critical path on an emergency request).
    await db('blood_request_matches').insert(donors.map((donor) => ({
      blood_request_id: id,
      donor_user_id: donor.user_id,
      donor_profile_id: donor.id,
      notification_sent: true,
      response_status: MATCH_RESPONSE.PENDING,
    })));
    await notifyMany(donors.map((d) => d.user_id), donorRequestCopy(createdRow));
    await db('blood_requests').where({ id }).update({ status: BLOOD_REQUEST_STATUS.MATCHED });
  }

  // Tell the requester what actually happened to their request. The API response
  // already says this, but they are about to close the app and wait — and the
  // no-donors case especially must not be silent: someone waiting at a hospital
  // for a match that was never sent needs to know to try another channel.
  await notify(userId, donors.length
    ? {
      title: `✅ ${donors.length} donor${donors.length > 1 ? 's' : ''} notified`,
      message: `Your ${b.blood_group_required} request at ${b.hospital_name} is live. We've alerted ${donors.length} matching donor${donors.length > 1 ? 's' : ''} nearby — we'll notify you the moment someone accepts.`,
      type: NOTIFICATION_TYPE.BLOOD_ACCEPTED,
      referenceId: id,
    }
    : {
      title: '⏳ No matching donors yet',
      message: `Your ${b.blood_group_required} request at ${b.hospital_name} is live, but no available donors match right now. We'll alert them the moment one becomes available — please arrange a backup too.`,
      type: NOTIFICATION_TYPE.BLOOD_ACCEPTED,
      referenceId: id,
    });

  const request = await db('blood_requests').where({ id }).first();
  return created(res, { request, matchedDonors: donors.length }, `Request created. ${donors.length} donor(s) notified.`);
});

// GET /blood/requests/mine
const myRequests = asyncHandler(async (req, res) => {
  await expireStaleBloodRequests();
  const rows = await db('blood_requests').where({ requester_id: req.user.id }).orderBy('id', 'desc');
  return ok(res, rows);
});

// GET /blood/requests/:id  — detail; shares donor contacts only for accepted matches
const requestDetail = asyncHandler(async (req, res) => {
  await expireStaleBloodRequests();
  const request = await db('blood_requests').where({ id: req.params.id }).first();
  if (!request) throw ApiError.notFound('Request not found');
  const isOwner = request.requester_id === req.user.id;
  if (!isOwner && req.user.role !== ROLES.ADMIN) throw ApiError.forbidden();

  const matches = await db('blood_request_matches as m')
    .join('users as u', 'u.id', 'm.donor_user_id')
    .leftJoin('user_profiles as p', 'p.user_id', 'u.id')
    .where('m.blood_request_id', request.id)
    // Don't surface donors whose account was since blocked/deleted — they aren't
    // reachable and shouldn't appear in the requester's matched-donors list.
    .andWhere('u.status', USER_STATUS.ACTIVE)
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
  // Already-closed requests can't be cancelled again (avoids re-notifying donors).
  if (!ACTIVE_REQUEST_STATUSES.includes(request.status)) {
    throw ApiError.conflict(`This request is already ${request.status}.`);
  }
  await db('blood_requests').where({ id: request.id }).update({
    status: BLOOD_REQUEST_STATUS.CANCELLED,
    notes: req.body.reason ? `${request.notes || ''}\nCancelled: ${req.body.reason}` : request.notes,
  });
  // Let matched donors know it's closed so it clears from their list.
  await notifyMatchedDonors(request.id, {
    title: '🚫 Blood request cancelled',
    message: `The ${request.blood_group_required} request at ${request.hospital_name}, ${request.city} was cancelled. No action needed — thank you for being available.`,
    type: NOTIFICATION_TYPE.BLOOD,
    referenceId: request.id,
  });
  return ok(res, null, 'Request cancelled');
});

// POST /blood/requests/:id/fulfill
const fulfillRequest = asyncHandler(async (req, res) => {
  const request = await db('blood_requests').where({ id: req.params.id, requester_id: req.user.id }).first();
  if (!request) throw ApiError.notFound('Request not found');
  // Only an active request can be marked fulfilled (not an already-closed one).
  if (!ACTIVE_REQUEST_STATUSES.includes(request.status)) {
    throw ApiError.conflict(`This request is already ${request.status}.`);
  }
  await db('blood_requests').where({ id: request.id }).update({ status: BLOOD_REQUEST_STATUS.FULFILLED });
  // Reflect on the donor side + thank everyone who was matched.
  await notifyMatchedDonors(request.id, {
    title: '❤️ Blood request fulfilled',
    message: `The ${request.blood_group_required} request at ${request.hospital_name} has been fulfilled. Thank you for stepping up — you helped save a life.`,
    type: NOTIFICATION_TYPE.BLOOD,
    referenceId: request.id,
  });
  return ok(res, null, 'Marked as fulfilled');
});

// ---- Donor responses --------------------------------------------------

// GET /blood/donor/requests  — requests this donor was matched to
const donorIncomingRequests = asyncHandler(async (req, res) => {
  await expireStaleBloodRequests();
  const rows = await db('blood_request_matches as m')
    .join('blood_requests as r', 'r.id', 'm.blood_request_id')
    .where('m.donor_user_id', req.user.id)
    .select(
      'm.id as match_id', 'm.response_status', 'm.contact_shared',
      'r.id as request_id', 'r.patient_name', 'r.blood_group_required', 'r.units_required',
      'r.hospital_name', 'r.hospital_address', 'r.city', 'r.urgency_level', 'r.required_at', 'r.created_at', 'r.status',
      // Requester contact only after the donor accepts.
      db.raw('CASE WHEN m.contact_shared = 1 THEN r.contact_person_name ELSE NULL END as contact_person_name'),
      db.raw('CASE WHEN m.contact_shared = 1 THEN r.contact_person_mobile ELSE NULL END as contact_person_mobile')
    )
    .orderBy('m.id', 'desc');
  return ok(res, rows);
});

// GET /blood/requests/open  — open requests near this donor (browse feed).
// Shows every still-open request matching the donor's blood group + city,
// regardless of whether a match row was pre-created, plus this donor's own
// response state so the UI can show Accept/Decline or "accepted".
const donorOpenRequests = asyncHandler(async (req, res) => {
  await expireStaleBloodRequests();
  const donor = await db('donor_profiles').where({ user_id: req.user.id }).first();
  if (!donor) throw ApiError.notFound('You are not registered as a donor');
  if (!donor.blood_group || !donor.city) return ok(res, []);

  const donorCityFeed = cityOverlapRaw('r.city', donor.city);
  const rows = await db('blood_requests as r')
    .leftJoin('blood_request_matches as m', function joinMatch() {
      this.on('m.blood_request_id', 'r.id').andOn('m.donor_user_id', '=', db.raw('?', [req.user.id]));
    })
    .where('r.blood_group_required', donor.blood_group)
    .whereIn('r.status', ACTIVE_REQUEST_STATUSES)
    .whereRaw(donorCityFeed.clause, donorCityFeed.bindings)
    .andWhere('r.requester_id', '!=', req.user.id)
    .select(
      'r.id as request_id', 'r.patient_name', 'r.blood_group_required', 'r.units_required',
      'r.hospital_name', 'r.hospital_address', 'r.city', 'r.urgency_level', 'r.required_at', 'r.status',
      'm.id as match_id', 'm.response_status', 'm.contact_shared',
      db.raw('CASE WHEN m.contact_shared = 1 THEN r.contact_person_name ELSE NULL END as contact_person_name'),
      db.raw('CASE WHEN m.contact_shared = 1 THEN r.contact_person_mobile ELSE NULL END as contact_person_mobile')
    )
    .orderBy('r.id', 'desc');
  // The SQL clause over-matches by design (substring); citiesOverlap decides.
  return ok(res, rows.filter((r) => citiesOverlap(donor.city, r.city)));
});

// POST /blood/matches/:id/respond  { action: 'accept' | 'decline' }
const respondToMatch = asyncHandler(async (req, res) => {
  const { action } = req.body;
  if (action === 'accept') requireKyc(req); // accepting = committing to donate
  const match = await db('blood_request_matches').where({ id: req.params.id, donor_user_id: req.user.id }).first();
  if (!match) throw ApiError.notFound('Match not found');
  const request = await db('blood_requests').where({ id: match.blood_request_id }).first();
  return applyMatchResponse({ match, request, action, userId: req.user.id, res });
});

// POST /blood/requests/:id/respond  { action } — respond straight from the
// browse feed; creates the match row on the fly if one doesn't exist yet.
const respondToRequest = asyncHandler(async (req, res) => {
  const { action } = req.body;
  if (action === 'accept') requireKyc(req); // accepting = committing to donate
  const donor = await db('donor_profiles').where({ user_id: req.user.id }).first();
  if (!donor) throw ApiError.notFound('You are not registered as a donor');
  const request = await db('blood_requests').where({ id: req.params.id }).first();
  if (!request) throw ApiError.notFound('Request not found');

  // A donor may only respond to a request they actually qualify for — the SAME
  // rules the browse feed (donorOpenRequests) enforces. Without this a donor
  // could POST any request id and harvest its contact details regardless of
  // status / blood group / city (privacy leak).
  if (!ACTIVE_REQUEST_STATUSES.includes(request.status)) {
    throw ApiError.conflict('This request is no longer open.');
  }
  if (request.requester_id === req.user.id) {
    throw ApiError.badRequest('You cannot respond to your own request.');
  }
  const groupMatches = request.blood_group_required === donor.blood_group;
  if (!groupMatches || !citiesOverlap(donor.city, request.city)) {
    throw ApiError.forbidden('This request does not match your blood group or city.');
  }

  let match = await db('blood_request_matches')
    .where({ blood_request_id: request.id, donor_user_id: req.user.id }).first();
  if (!match) {
    const [mid] = await db('blood_request_matches').insert({
      blood_request_id: request.id,
      donor_user_id: req.user.id,
      donor_profile_id: donor.id,
      notification_sent: false,
      response_status: MATCH_RESPONSE.PENDING,
    });
    match = await db('blood_request_matches').where({ id: mid }).first();
    if (request.status === BLOOD_REQUEST_STATUS.OPEN) {
      await db('blood_requests').where({ id: request.id }).update({ status: BLOOD_REQUEST_STATUS.MATCHED });
    }
  }
  return applyMatchResponse({ match, request, action, userId: req.user.id, res });
});

module.exports = {
  becomeDonor, setAvailability, myDonorProfile,
  createRequest, myRequests, requestDetail, cancelRequest, fulfillRequest,
  donorIncomingRequests, donorOpenRequests, respondToMatch, respondToRequest,
};
