const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/catalogController');

// Browsing the catalogue requires login (consistent with the app's auth-first flow).
router.use(authenticate);
router.get('/categories', c.categories);
router.get('/medicines', c.medicines);
router.get('/medicines/:id', c.medicineDetail);

module.exports = router;
