const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const c = require('../controllers/adminController');
const { ROLES } = require('../constants/enums');

router.use(authenticate, requireRole(ROLES.ADMIN));

router.get('/dashboard', c.dashboard);

// Users
router.get('/users', c.listUsers);
router.put('/users/:id/status', c.setUserStatus);
router.delete('/users/:id', c.deleteUser);

// Pharmacies
router.get('/pharmacies', c.listPharmacies);
router.get('/pharmacies/:id', c.pharmacyDetail);
router.put('/pharmacies/:id/review', c.reviewPharmacy);

// Aadhaar manual KYC submissions (users upload card photos → admin verifies)
router.get('/aadhaar', c.listAadhaarSubmissions);
router.get('/aadhaar/:id', c.aadhaarSubmissionDetail);
router.put('/aadhaar/:id/review', c.reviewAadhaarSubmission);

// Blood requests
router.get('/blood-requests', c.listBloodRequests);
router.put('/blood-requests/:id/status', c.setBloodRequestStatus);
router.get('/blood-donors', c.listDonors);

// Ambulance
router.get('/ambulance-requests', c.listAmbulanceRequests);
router.put('/ambulance-requests/:id/assign', c.assignAmbulance);
router.post('/ambulance-providers', c.addProvider);
router.post('/ambulances', c.addAmbulance);
router.get('/ambulances', c.listAmbulances);
// Driver self-registered vehicles awaiting approval
router.get('/ambulance-vehicles', c.listAmbulanceVehicles);
router.get('/ambulance-vehicles/:id', c.ambulanceVehicleDetail);
router.put('/ambulance-vehicles/:id/review', c.reviewAmbulanceVehicle);
router.get('/drivers', c.listDrivers);
router.post('/drivers', c.createDriver);

// Medicine moderation
router.post('/categories', c.addCategory);
router.post('/medicines', c.addMasterMedicine);
router.put('/medicines/:id/status', c.setMedicineStatus);

// Orders
router.get('/orders', c.listOrders);

// Support
router.get('/tickets', c.listTickets);
router.put('/tickets/:id', c.updateTicket);

// Audit
router.get('/audit-logs', c.listAuditLogs);

module.exports = router;
