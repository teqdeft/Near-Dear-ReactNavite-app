const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/aiController');

router.post('/parse-ambulance', authenticate, c.parseAmbulance);

module.exports = router;
