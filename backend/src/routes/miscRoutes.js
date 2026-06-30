const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const notifications = require('../controllers/notificationController');
const support = require('../controllers/supportController');

router.use(authenticate);

// Notifications
router.get('/notifications', notifications.list);
router.put('/notifications/read-all', notifications.markAllRead);
router.put('/notifications/:id/read', notifications.markRead);

// Support
router.post('/support/tickets', support.create);
router.get('/support/tickets', support.myTickets);

module.exports = router;
