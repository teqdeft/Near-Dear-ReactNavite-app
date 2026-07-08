const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { upload, intoFolder } = require('../middleware/upload');
const c = require('../controllers/profileController');

router.use(authenticate);
router.put('/', c.updateProfile);
router.post('/avatar', intoFolder('profiles'), upload.single('file'), c.uploadAvatar);
router.get('/addresses', c.listAddresses);
router.post('/addresses', c.addAddress);
router.delete('/addresses/:id', c.deleteAddress);
router.post('/delete-request', c.requestAccountDeletion);

module.exports = router;
