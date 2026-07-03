const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { upload, intoFolder } = require('../middleware/upload');
const c = require('../controllers/ambulanceController');

router.use(authenticate);

// Driver's own vehicle registration + documents (admin approves before rides).
router.get('/driver/vehicle', c.myVehicle);
router.post('/driver/vehicle', [body('vehicle_number').trim().notEmpty().withMessage('Vehicle number is required'), validate], c.registerVehicle);
router.post('/driver/vehicle/documents', intoFolder('ambulance_docs'), upload.single('file'), c.uploadVehicleDocument);

router.post(
  '/requests',
  [
    body('patient_name').trim().notEmpty().withMessage('Patient name is required'),
    body('contact_mobile').trim().isLength({ min: 10, max: 15 }).withMessage('Valid contact mobile is required'),
    body('pickup_address').trim().notEmpty().withMessage('Pickup address is required'),
    validate,
  ],
  c.createRequest
);
router.get('/requests/mine', c.myRequests);
router.get('/driver/requests', c.driverRequests);
router.get('/driver/available', c.driverAvailable);
router.post('/driver/location', c.updateLocation); // driver pushes live GPS
router.get('/requests/:id', c.requestDetail);
router.get('/requests/:id/track', c.trackRequest); // user polls live GPS
router.post('/requests/:id/cancel', c.cancelRequest);
router.post('/requests/:id/accept', c.acceptRequest);
router.put('/requests/:id/status', c.updateStatus);

module.exports = router;
