const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/authController');

const mobileRule = body('mobile').isString().isLength({ min: 10, max: 15 }).withMessage('Valid mobile required');

// request-otp accepts a mobile or an email (channel decides which) — the
// controller validates the destination, so no strict field rule here.
router.post('/request-otp', c.requestOtp);
router.post('/verify-otp', [mobileRule, body('code').notEmpty().withMessage('OTP code required'), validate], c.verifyOtp);

// Forgot / reset password (OTP-based, works with mobile or email).
router.post('/forgot-password/request-otp', c.forgotPasswordRequestOtp);
router.post(
  '/forgot-password/reset',
  [body('code').notEmpty().withMessage('OTP code required'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'), validate],
  c.forgotPasswordReset
);

// Change password for a logged-in user.
router.post(
  '/change-password',
  [authenticate,
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'), validate],
  c.changePassword
);

// OTP-verified registration (role: user | ambulance_driver) + email/password login
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name required'),
    mobileRule,
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('code').notEmpty().withMessage('OTP code required'),
    validate,
  ],
  c.register
);
router.post('/login', [body('email').isEmail().withMessage('Valid email required'), body('password').notEmpty(), validate], c.loginEmail);
router.post(
  '/register-pharmacy',
  [
    body('owner_name').trim().notEmpty().withMessage('Owner name required'),
    mobileRule,
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    validate,
  ],
  c.registerPharmacy
);
router.post('/admin-login', [mobileRule, body('password').notEmpty(), validate], c.passwordLogin);
router.post('/refresh', c.refresh);
router.get('/me', authenticate, c.me);

// Aadhaar KYC
router.post('/aadhaar/generate-otp', [authenticate, body('aadhaarNumber').notEmpty(), validate], c.aadhaarGenerateOtp);
router.post('/aadhaar/verify', [authenticate, body('otp').notEmpty(), validate], c.aadhaarVerify);

module.exports = router;
