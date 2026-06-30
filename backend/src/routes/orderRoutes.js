const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { upload, intoFolder } = require('../middleware/upload');
const orders = require('../controllers/orderController');
const prescriptions = require('../controllers/prescriptionController');

router.use(authenticate);

// Prescriptions
router.post('/prescriptions', intoFolder('prescriptions'), upload.single('file'), prescriptions.upload);
router.get('/prescriptions', prescriptions.myPrescriptions);

// Orders
router.post('/', orders.placeOrder);
router.get('/', orders.myOrders);
router.get('/:id', orders.orderDetail);
router.post('/:id/cancel', orders.cancelOrder);

module.exports = router;
