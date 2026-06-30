const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/ambulanceController');

router.use(authenticate);

router.post('/requests', c.createRequest);
router.get('/requests/mine', c.myRequests);
router.get('/driver/requests', c.driverRequests);
router.get('/driver/available', c.driverAvailable);
router.get('/requests/:id', c.requestDetail);
router.post('/requests/:id/cancel', c.cancelRequest);
router.post('/requests/:id/accept', c.acceptRequest);
router.put('/requests/:id/status', c.updateStatus);

module.exports = router;
