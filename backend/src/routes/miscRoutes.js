const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const notifications = require('../controllers/notificationController');
const support = require('../controllers/supportController');

router.use(authenticate);

// Notifications
router.get('/notifications', notifications.list);
router.get('/notifications/unread-count', notifications.unreadCount);
router.post('/notifications/device-token', notifications.registerDevice);
router.delete('/notifications/device-token', notifications.unregisterDevice);
router.put('/notifications/read-all', notifications.markAllRead);
router.put('/notifications/:id/read', notifications.markRead);
// After the /device-token delete above, so ":id" doesn't swallow "device-token".
router.delete('/notifications/:id', notifications.remove);

// Support
router.post('/support/tickets', support.create);
router.get('/support/tickets', support.myTickets);

module.exports = router;
