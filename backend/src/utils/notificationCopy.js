const { ORDER_STATUS, AMBULANCE_STATUS, URGENCY } = require('../constants/enums');

/**
 * The words users actually read.
 *
 * A push is often the ONLY thing a user sees — a donor glances at their lock
 * screen and decides in two seconds whether to open the app. "Order update — your
 * order is now: out for delivery" wastes both lines saying nothing they can act
 * on. So every message here answers what happened, to what, and what to do next,
 * with the specifics (hospital, city, amount, ETA) inlined rather than hidden
 * behind a tap.
 *
 * Emoji are load-bearing, not decoration: they are the only visual differentiator
 * Android gives us in a crowded tray, where every app's row looks identical. One
 * per notification, at the front — never mid-sentence, and never more than one, or
 * it reads as spam rather than as an emergency.
 *
 * The status maps below are keyed by the same enums the state machine uses, so a
 * new status cannot be added without deciding what the user gets told about it.
 */

// ₹1,250 — not ₹1250. Indian grouping, since that is what the amount will be
// compared against on the user's own bank SMS.
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// Blood requests carry an urgency the requester chose. It changes what a donor
// should do about the notification, so it belongs in the title, not buried.
const URGENCY_PREFIX = {
  [URGENCY.CRITICAL]: '🚨 CRITICAL',
  [URGENCY.URGENT]: '⚡ Urgent',
  [URGENCY.NORMAL]: '🩸',
};

/**
 * What a user is told at each step of their medicine order.
 * @param {object} order - medicine_orders row
 * @param {string} pharmacyName
 */
const ORDER_STATUS_COPY = {
  [ORDER_STATUS.ACCEPTED]: (o, pharmacy) => ({
    title: '✅ Order accepted',
    message: `${pharmacy} accepted order ${o.order_number}. They're preparing your medicines now.`,
  }),
  [ORDER_STATUS.PREPARING]: (o, pharmacy) => ({
    title: '📦 Order being prepared',
    message: `${pharmacy} is packing order ${o.order_number}. It will be out for delivery shortly.`,
  }),
  [ORDER_STATUS.OUT_FOR_DELIVERY]: (o, pharmacy) => ({
    title: '🛵 Out for delivery',
    message: `Order ${o.order_number} from ${pharmacy} is on its way to you. Keep ${money(o.total_amount)} ready if paying cash.`,
  }),
  [ORDER_STATUS.DELIVERED]: (o) => ({
    title: '🎉 Order delivered',
    message: `Order ${o.order_number} has been delivered. Get well soon!`,
  }),
  // The only status where the user is owed a REASON — they are about to wonder
  // why, and an unexplained rejection sends them straight to support.
  [ORDER_STATUS.REJECTED]: (o, pharmacy, reason) => ({
    title: '❌ Order rejected',
    message: `${pharmacy} could not fulfil order ${o.order_number}.${reason ? ` Reason: ${reason}.` : ''} Any amount paid will be refunded. You can try another pharmacy.`,
  }),
};

/**
 * What the requesting user is told as their ambulance moves through its states.
 * ASSIGNED/ACCEPTED are notified at their own call sites (they carry driver and
 * vehicle details this map has no access to).
 */
const AMBULANCE_STATUS_COPY = {
  [AMBULANCE_STATUS.ON_THE_WAY]: () => ({
    title: '🚑 Ambulance on the way',
    message: 'Your ambulance has started and is heading to the pickup location. Track it live in the app.',
  }),
  [AMBULANCE_STATUS.PICKED_UP]: (r) => ({
    title: '🏥 Patient picked up',
    message: `${r.patient_name} has been picked up${r.drop_address ? ` and is on the way to ${r.drop_address}` : ''}.`,
  }),
  [AMBULANCE_STATUS.COMPLETED]: () => ({
    title: '✅ Ride completed',
    message: 'Your ambulance ride is complete. We hope everything is alright — thank you for using NearDear.',
  }),
  [AMBULANCE_STATUS.CANCELLED]: () => ({
    title: '❌ Ambulance cancelled',
    message: 'Your ambulance request has been cancelled. Book again any time if you still need one.',
  }),
};

module.exports = {
  money, URGENCY_PREFIX, ORDER_STATUS_COPY, AMBULANCE_STATUS_COPY,
};
