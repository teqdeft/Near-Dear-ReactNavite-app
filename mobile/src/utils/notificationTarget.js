/**
 * Where a notification takes the user when tapped.
 *
 * Shared on purpose: the same notification can be tapped in the Alerts list, in
 * the in-app banner, or in the Android tray, and all three must land on the same
 * screen. Kept in one place so a new notification type cannot be routed correctly
 * from one surface and dropped on the floor by another.
 *
 * `reference_id` points at the related entity (order / request id). Returns null
 * when there is no meaningful detail screen — a generic admin alert, or a screen
 * that isn't part of this user's navigator.
 */
export function notificationTarget(item, { isDriver, isDonor, isPharmacyOwner }) {
  const id = item.reference_id;

  if (isDriver) {
    // The driver stack only registers the driver tabs + Support, so anything else
    // would navigate to a screen that does not exist for them.
    if (item.type === 'ambulance') return { screen: 'DriverTrips' };
    if (item.type === 'support') return { screen: 'Support' };
    return null;
  }

  // A pharmacy owner's order notifications ("🛒 New medicine order") are about
  // orders placed WITH them, not BY them — and OrderDetail below fetches
  // GET /orders/:id, which is scoped to the buyer. Sending them there lands them on
  // "Order not found". They manage orders from the web panel; the app has no screen
  // for it, so there is nowhere to go and the notification stays read-only in Alerts.
  if (isPharmacyOwner && item.type === 'medicine_order') return null;

  switch (item.type) {
    case 'medicine_order': return id ? { screen: 'OrderDetail', params: { id } } : null;
    case 'ambulance': return id ? { screen: 'AmbulanceDetail', params: { id } } : null;
    case 'blood_accepted':
      // Requester-facing: a donor accepted THIS user's request, so always open
      // their own request detail — even if the user is also a donor.
      return id ? { screen: 'BloodRequestDetail', params: { id } } : null;
    case 'blood':
      // Donor-facing (a request near them). Donors act on it from the "Requests
      // for me" list (accept / decline); the requester's contact stays hidden
      // there until they accept. A non-donor requester tracks their own request
      // in its detail page.
      if (isDonor) return { screen: 'DonorRequests' };
      return id ? { screen: 'BloodRequestDetail', params: { id } } : null;
    case 'support': return { screen: 'Support' };
    default: return null;
  }
}

/**
 * Normalises an FCM message into the shape notificationTarget expects.
 *
 * FCM data values are always strings — the transport has no other type — so an
 * absent referenceId arrives as '' and an id arrives as '42'. Passing '42'
 * straight through would give a screen `{ id: '42' }` where every other caller
 * hands it a number, which is the kind of mismatch that only shows up as a
 * failed lookup deep in a detail screen.
 */
export function fromPushMessage(msg) {
  const d = msg?.data || {};
  const id = Number(d.referenceId);
  return {
    type: d.type || null,
    reference_id: Number.isFinite(id) && d.referenceId !== '' ? id : null,
  };
}

export default notificationTarget;
