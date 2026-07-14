const router = require('express').Router();
const { authenticate } = require('../middleware/auth');

const authRoutes = require('./authRoutes');
const profileRoutes = require('./profileRoutes');
const bloodRoutes = require('./bloodRoutes');
const ambulanceRoutes = require('./ambulanceRoutes');
const catalogRoutes = require('./catalogRoutes');
const orderRoutes = require('./orderRoutes');
const pharmacyRoutes = require('./pharmacyRoutes');
const adminRoutes = require('./adminRoutes');
const miscRoutes = require('./miscRoutes');
// [AI] Speak-to-book is built but switched off. Uncomment this and the mount below
// to turn it back on. See src/services/aiService.js.
// const aiRoutes = require('./aiRoutes');
const fileController = require('../controllers/fileController');

router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/blood', bloodRoutes);
router.use('/ambulance', ambulanceRoutes);
router.use('/catalog', catalogRoutes);
router.use('/orders', orderRoutes);
router.use('/pharmacy', pharmacyRoutes);
router.use('/admin', adminRoutes);
// [AI] off for now — see the commented require above.
// router.use('/ai', aiRoutes);
router.use('/', miscRoutes); // notifications + support

// Private file serving (authenticated).
router.get('/files/*', authenticate, fileController.serve);

module.exports = router;
