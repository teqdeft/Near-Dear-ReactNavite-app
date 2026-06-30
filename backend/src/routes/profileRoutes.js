const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/profileController');

router.use(authenticate);
router.put('/', c.updateProfile);
router.get('/addresses', c.listAddresses);
router.post('/addresses', c.addAddress);
router.delete('/addresses/:id', c.deleteAddress);
router.post('/delete-request', c.requestAccountDeletion);

module.exports = router;
