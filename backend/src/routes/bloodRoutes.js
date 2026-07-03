const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/bloodController');

router.use(authenticate);

// Donor
router.post(
  '/donor',
  [body('blood_group').trim().notEmpty().withMessage('Blood group is required'), validate],
  c.becomeDonor
);
router.get('/donor/me', c.myDonorProfile);
router.put('/donor/availability', c.setAvailability);
router.get('/donor/requests', c.donorIncomingRequests);

// Blood requests
router.post(
  '/requests',
  [
    body('patient_name').trim().notEmpty().withMessage('Patient name is required'),
    body('blood_group_required').trim().notEmpty().withMessage('Blood group is required'),
    body('hospital_name').trim().notEmpty().withMessage('Hospital name is required'),
    body('city').trim().notEmpty().withMessage('City is required'),
    body('contact_person_mobile').trim().isLength({ min: 10, max: 15 }).withMessage('Valid contact mobile is required'),
    validate,
  ],
  c.createRequest
);
router.get('/requests/mine', c.myRequests);
router.get('/requests/open', c.donorOpenRequests); // must precede '/requests/:id'
router.get('/requests/:id', c.requestDetail);
router.post('/requests/:id/cancel', c.cancelRequest);
router.post('/requests/:id/fulfill', c.fulfillRequest);
router.post('/requests/:id/respond', c.respondToRequest);

// Donor responses to matches
router.post('/matches/:id/respond', c.respondToMatch);

module.exports = router;
