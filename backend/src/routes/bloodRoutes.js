const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/bloodController');

router.use(authenticate);

// Donor
router.post('/donor', c.becomeDonor);
router.get('/donor/me', c.myDonorProfile);
router.put('/donor/availability', c.setAvailability);
router.get('/donor/requests', c.donorIncomingRequests);

// Blood requests
router.post('/requests', c.createRequest);
router.get('/requests/mine', c.myRequests);
router.get('/requests/:id', c.requestDetail);
router.post('/requests/:id/cancel', c.cancelRequest);
router.post('/requests/:id/fulfill', c.fulfillRequest);

// Donor responses to matches
router.post('/matches/:id/respond', c.respondToMatch);

module.exports = router;
