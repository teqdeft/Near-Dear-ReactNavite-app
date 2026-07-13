const crypto = require('crypto');
const db = require('../db/knex');
const { ok, created } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notify } = require('../services/notificationService');
const { servesTarget } = require('../utils/serviceArea');
const {
  ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, PHARMACY_APPROVAL,
  ACTIVE_STATUS, STOCK_STATUS, NOTIFICATION_TYPE,
} = require('../constants/enums');

// A, B, C... for Jan, Feb, Mar... (Dec = L). A plain first-letter scheme would
// clash (Jan/Jun/Jul all start with J), so this maps each month to a unique,
// unambiguous letter instead.
const MONTH_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

// First 3 alphabetic characters of the city, uppercased (spaces/punctuation
// stripped). Falls back to 'GEN' for a missing/unusual city, and pads short
// names so the code is always exactly 3 characters.
function cityCode(city) {
  const letters = String(city || '').toUpperCase().replace(/[^A-Z]/g, '');
  return (letters.slice(0, 3) || 'GEN').padEnd(3, 'X');
}

// Order number format: [City 3 letters][Day 2 digits][Month letter][secure random].
// e.g. pharmacy in Mohali, placed on 8 July -> "MOH08G4F91A2C7".
function genOrderNumber(city) {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = MONTH_LETTERS[now.getMonth()];
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${cityCode(city)}${day}${month}${rand}`;
}

// POST /orders
// body: { pharmacy_id, items:[{pharmacy_medicine_id, quantity}], delivery_address_id, prescription_id?, payment_method, delivery_fee? }
const placeOrder = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { pharmacy_id, items, delivery_address_id, prescription_id, payment_method } = req.body;
  // Never trust a client-supplied fee blindly — clamp to a non-negative number
  // so it can't be used to reduce (or inflate) the order total.
  const delivery_fee = Math.max(0, Number(req.body.delivery_fee) || 0);

  if (!Array.isArray(items) || items.length === 0) throw ApiError.badRequest('Cart is empty');

  const pharmacy = await db('pharmacies').where({ id: pharmacy_id }).first();
  if (!pharmacy || pharmacy.approval_status !== PHARMACY_APPROVAL.APPROVED) {
    throw ApiError.badRequest('Pharmacy is not available');
  }

  // Load the listings being ordered and validate they belong to this pharmacy.
  const ids = items.map((i) => i.pharmacy_medicine_id);
  const listings = await db('pharmacy_medicines as pm')
    .leftJoin('medicines as m', 'm.id', 'pm.medicine_id')
    .whereIn('pm.id', ids)
    .andWhere('pm.pharmacy_id', pharmacy_id)
    .select('pm.*', 'm.name as medicine_name');
  const byId = Object.fromEntries(listings.map((l) => [l.id, l]));

  let subtotal = 0;
  let prescriptionNeeded = false;
  const orderItems = [];

  for (const item of items) {
    const listing = byId[item.pharmacy_medicine_id];
    if (!listing) throw ApiError.badRequest('One or more items are not from this pharmacy');
    if (listing.status !== ACTIVE_STATUS.ACTIVE || listing.stock_status !== STOCK_STATUS.IN_STOCK) {
      throw ApiError.badRequest(`${listing.medicine_name || listing.custom_name} is out of stock`);
    }
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const lineTotal = Number(listing.price) * qty;
    subtotal += lineTotal;
    if (listing.prescription_required) prescriptionNeeded = true;
    orderItems.push({
      pharmacy_medicine_id: listing.id,
      medicine_name_snapshot: listing.medicine_name || listing.custom_name,
      price_snapshot: listing.price,
      quantity: qty,
      total_price: lineTotal,
    });
  }

  // Prescription requirement at checkout: the user must ATTACH a prescription
  // they own — but it does NOT need to be approved yet. The pharmacy reviews it
  // after the order is placed and then accepts or rejects the order.
  if (prescriptionNeeded) {
    if (!prescription_id) throw ApiError.badRequest('This order requires a prescription. Please upload one.');
    const presc = await db('prescriptions').where({ id: prescription_id, user_id: userId }).first();
    if (!presc) throw ApiError.badRequest('Prescription not found');
  }

  // Delivery address must belong to the ordering user (else it's an IDOR that
  // leaks another user's address to the pharmacy).
  let orderCity = null;
  if (delivery_address_id) {
    const addr = await db('user_addresses').where({ id: delivery_address_id, user_id: userId }).first();
    if (!addr) throw ApiError.badRequest('Delivery address not found');
    // The pharmacy must actually reach this address — the same rule the catalog
    // used to decide what to show. Without this a client could order from any
    // pharmacy id, including one in another state.
    if (!servesTarget(addr, pharmacy)) {
      throw ApiError.badRequest('This pharmacy does not deliver to the selected address.');
    }
    orderCity = addr.city;
  } else {
    // No delivery address on this order (e.g. pickup) — fall back to the
    // user's own profile city for the order number.
    const profile = await db('user_profiles').where({ user_id: userId }).first();
    orderCity = profile?.city || null;
  }

  const total = subtotal + Number(delivery_fee || 0);

  let orderNumber;
  const orderId = await db.transaction(async (trx) => {
    let id;
    // Collisions are astronomically unlikely (secure random suffix), but retry
    // with a fresh number rather than fail the order on the rare duplicate.
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      orderNumber = genOrderNumber(orderCity);
      try {
        // eslint-disable-next-line no-await-in-loop
        [id] = await trx('medicine_orders').insert({
          order_number: orderNumber,
          user_id: userId,
          pharmacy_id,
          prescription_id: prescription_id || null,
          delivery_address_id: delivery_address_id || null,
          subtotal,
          delivery_fee,
          total_amount: total,
          payment_method: payment_method || PAYMENT_METHOD.COD,
          payment_status: PAYMENT_STATUS.PENDING,
          order_status: ORDER_STATUS.PLACED,
        });
        break;
      } catch (e) {
        const isDuplicate = e?.code === 'ER_DUP_ENTRY' || /order_number/i.test(e?.sqlMessage || '');
        if (!isDuplicate || attempt === 5) throw e;
      }
    }
    await trx('medicine_order_items').insert(orderItems.map((oi) => ({ ...oi, order_id: id })));
    await trx('order_status_history').insert({
      order_id: id, status: ORDER_STATUS.PLACED, changed_by_user_id: userId, note: 'Order placed',
    });
    return id;
  });

  await notify(pharmacy.owner_user_id, {
    title: 'New medicine order',
    message: `Order ${orderNumber} placed (₹${total}).`,
    type: NOTIFICATION_TYPE.MEDICINE_ORDER,
    referenceId: orderId,
  });

  const order = await db('medicine_orders').where({ id: orderId }).first();
  return created(res, order, 'Order placed');
});

// GET /orders  — current user's orders
const myOrders = asyncHandler(async (req, res) => {
  const rows = await db('medicine_orders as o')
    .leftJoin('pharmacies as ph', 'ph.id', 'o.pharmacy_id')
    .where('o.user_id', req.user.id)
    .select('o.*', 'ph.pharmacy_name')
    .orderBy('o.id', 'desc');
  return ok(res, rows);
});

// GET /orders/:id
const orderDetail = asyncHandler(async (req, res) => {
  const order = await db('medicine_orders as o')
    .leftJoin('pharmacies as ph', 'ph.id', 'o.pharmacy_id')
    .where('o.id', req.params.id)
    .andWhere('o.user_id', req.user.id)
    .select('o.*', 'ph.pharmacy_name', 'ph.mobile as pharmacy_mobile')
    .first();
  if (!order) throw ApiError.notFound('Order not found');
  const [items, history] = await Promise.all([
    // Join the current listing so the app can offer "Order again" — it needs
    // whether the item still exists, is in stock, and if it needs a prescription.
    db('medicine_order_items as oi')
      .leftJoin('pharmacy_medicines as pm', 'pm.id', 'oi.pharmacy_medicine_id')
      .where('oi.order_id', order.id)
      .select('oi.*', 'pm.prescription_required', 'pm.stock_status', 'pm.status as listing_status'),
    db('order_status_history').where({ order_id: order.id }).orderBy('id', 'asc'),
  ]);
  return ok(res, { order, items, history });
});

// POST /orders/:id/cancel  — only before the pharmacy accepts
const cancelOrder = asyncHandler(async (req, res) => {
  const order = await db('medicine_orders').where({ id: req.params.id, user_id: req.user.id }).first();
  if (!order) throw ApiError.notFound('Order not found');
  if (order.order_status !== ORDER_STATUS.PLACED) {
    throw ApiError.badRequest('Order can only be cancelled before the pharmacy accepts it');
  }
  await db('medicine_orders').where({ id: order.id }).update({
    order_status: ORDER_STATUS.CANCELLED,
    cancellation_reason: req.body.reason || 'Cancelled by user',
  });
  await db('order_status_history').insert({
    order_id: order.id, status: ORDER_STATUS.CANCELLED, changed_by_user_id: req.user.id, note: req.body.reason || null,
  });
  return ok(res, null, 'Order cancelled');
});

module.exports = { placeOrder, myOrders, orderDetail, cancelOrder };
