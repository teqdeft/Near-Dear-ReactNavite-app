const crypto = require('crypto');
const db = require('../db/knex');
const { ok, created } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { notify } = require('../services/notificationService');
const {
  ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, PHARMACY_APPROVAL,
  ACTIVE_STATUS, STOCK_STATUS, NOTIFICATION_TYPE,
} = require('../constants/enums');

function genOrderNumber() {
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ND${Date.now().toString().slice(-8)}${rand}`;
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
  if (delivery_address_id) {
    const addr = await db('user_addresses').where({ id: delivery_address_id, user_id: userId }).first();
    if (!addr) throw ApiError.badRequest('Delivery address not found');
  }

  const total = subtotal + Number(delivery_fee || 0);
  const orderNumber = genOrderNumber();

  const orderId = await db.transaction(async (trx) => {
    const [id] = await trx('medicine_orders').insert({
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
