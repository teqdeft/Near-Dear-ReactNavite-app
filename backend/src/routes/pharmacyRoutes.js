const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { upload, intoFolder } = require('../middleware/upload');
const c = require('../controllers/pharmacyController');
const { ROLES } = require('../constants/enums');

router.use(authenticate);

// Any logged-in user may register a pharmacy (they get promoted to owner).
router.post('/register', c.register);
router.get('/me', c.myPharmacy);
router.post('/documents', intoFolder('pharmacy_docs'), upload.single('file'), c.uploadDocument);

// Pharmacy-owner / staff only beyond this point.
const pharmacyRole = requireRole(ROLES.PHARMACY_OWNER, ROLES.PHARMACY_STAFF);

router.get('/dashboard', pharmacyRole, c.dashboard);
router.get('/medicines', pharmacyRole, c.listMyMedicines);
router.post('/medicines', pharmacyRole, c.addMedicine);
router.put('/medicines/:id', pharmacyRole, c.updateMedicine);
router.post('/categories', pharmacyRole, c.addCategory);

router.get('/orders', pharmacyRole, c.listOrders);
router.get('/orders/:id', pharmacyRole, c.orderDetail);
router.put('/orders/:id/status', pharmacyRole, c.updateOrderStatus);
router.put('/prescriptions/:id/review', pharmacyRole, c.reviewPrescription);

module.exports = router;
