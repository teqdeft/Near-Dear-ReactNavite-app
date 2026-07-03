const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { upload, intoFolder } = require('../middleware/upload');
const orders = require('../controllers/orderController');
const prescriptions = require('../controllers/prescriptionController');

router.use(authenticate);

// Prescriptions
router.post('/prescriptions', intoFolder('prescriptions'), upload.single('file'), prescriptions.upload);
router.get('/prescriptions', prescriptions.myPrescriptions);

// Orders
router.post(
  '/',
  [
    body('pharmacy_id').isInt({ gt: 0 }).withMessage('A pharmacy is required'),
    body('items').isArray({ min: 1 }).withMessage('Cart is empty'),
    body('items.*.pharmacy_medicine_id').isInt({ gt: 0 }).withMessage('Invalid item'),
    validate,
  ],
  orders.placeOrder
);
router.get('/', orders.myOrders);
router.get('/:id', orders.orderDetail);
router.post('/:id/cancel', orders.cancelOrder);

module.exports = router;
