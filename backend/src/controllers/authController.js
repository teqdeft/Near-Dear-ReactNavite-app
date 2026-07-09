const bcrypt = require('bcryptjs');
const db = require('../db/knex');
const { ok, created } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { issueTokens, verifyRefreshToken, signAccessToken } = require('../utils/jwt');
const otpService = require('../services/otpService');
const aadhaarService = require('../services/aadhaarService');
const { presentUser } = require('../utils/present');
const { renameUpload } = require('../utils/fileNaming');
const config = require('../config');

const fileUrl = (p) => (p ? `${config.appUrl}/api/v1/files/${p}` : null);
const { ROLES, USER_STATUS, AADHAAR_KYC_STATUS } = require('../constants/enums');

// Resolve the OTP destination from the chosen channel.
function otpDestination(channel, { mobile, email }) {
  if (channel === 'email') {
    if (!email) throw ApiError.badRequest('Email is required for email OTP');
    return email;
  }
  if (!mobile) throw ApiError.badRequest('Mobile number is required');
  return mobile;
}

// POST /auth/request-otp  { mobile?, email?, channel? }
const requestOtp = asyncHandler(async (req, res) => {
  const { mobile, email, channel = 'sms' } = req.body;
  const destination = otpDestination(channel, { mobile, email });
  const result = await otpService.requestOtp({ channel, destination }, 'login');
  return ok(res, result, 'OTP sent');
});

// POST /auth/verify-otp  -> login or auto-register a normal user (SMS/mobile)
const verifyOtp = asyncHandler(async (req, res) => {
  const { mobile, code } = req.body;
  await otpService.verifyOtp({ channel: 'sms', destination: mobile }, code, 'login');

  let user = await db('users').where({ mobile }).first();
  let isNewUser = false;

  if (!user) {
    const [id] = await db('users').insert({
      mobile,
      role: ROLES.USER,
      status: USER_STATUS.ACTIVE,
      is_mobile_verified: true,
      last_login_at: db.fn.now(),
    });
    user = await db('users').where({ id }).first();
    await db('user_profiles').insert({ user_id: id });
    isNewUser = true;
  } else {
    if (user.status === USER_STATUS.BLOCKED) throw ApiError.forbidden('Your account is blocked');
    await db('users').where({ id: user.id }).update({
      is_mobile_verified: true,
      last_login_at: db.fn.now(),
    });
    user = await db('users').where({ id: user.id }).first();
  }

  const tokens = issueTokens(user);
  // Profile is considered incomplete until the user has a name + city.
  const profile = await db('user_profiles').where({ user_id: user.id }).first();
  const profileComplete = Boolean(user.name && profile && profile.city);

  return ok(res, { user: presentUser(user), profileComplete, isNewUser, ...tokens }, 'Login successful');
});

// Roles a person may self-register as from the mobile app.
const SELF_REGISTER_ROLES = [ROLES.USER, ROLES.AMBULANCE_DRIVER];

// POST /auth/register  (OTP-verified signup with role + email + password)
// body: { name, mobile, email, password, role, code }
const register = asyncHandler(async (req, res) => {
  const { name, mobile, email, password, role, code, channel = 'sms' } = req.body;
  const finalRole = SELF_REGISTER_ROLES.includes(role) ? role : ROLES.USER;

  // Verify the OTP that was sent to the chosen channel (mobile or email).
  const destination = otpDestination(channel, { mobile, email });
  await otpService.verifyOtp({ channel, destination }, code, 'login');

  if (await db('users').where({ mobile }).first()) {
    throw ApiError.conflict('An account with this mobile already exists. Please log in.');
  }
  if (email && (await db('users').where({ email }).first())) {
    throw ApiError.conflict('This email is already registered. Please log in.');
  }

  const password_hash = await bcrypt.hash(password, 10);
  const [id] = await db('users').insert({
    name,
    mobile,
    email: email || null,
    password_hash,
    role: finalRole,
    status: USER_STATUS.ACTIVE,
    is_mobile_verified: true,
    last_login_at: db.fn.now(),
  });
  await db('user_profiles').insert({ user_id: id });

  const user = await db('users').where({ id }).first();
  const tokens = issueTokens(user);
  return created(res, { user: presentUser(user), ...tokens }, 'Account created');
});

// POST /auth/login  (email + password — for users & drivers; staff may also use admin-login)
const loginEmail = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await db('users').where({ email }).first();
  if (!user) throw ApiError.notFound('No account found with this email');
  if (!user || !user.password_hash) throw ApiError.unauthorized('Invalid email or password');
  if (user.status === USER_STATUS.BLOCKED) throw ApiError.forbidden('Your account is blocked');
  if (user.status === USER_STATUS.DELETED) throw ApiError.unauthorized('Account not found');

  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) throw ApiError.unauthorized('Invalid email or password');

  await db('users').where({ id: user.id }).update({ last_login_at: db.fn.now() });
  const tokens = issueTokens(user);
  return ok(res, { user: presentUser(user), ...tokens }, 'Login successful');
});

// POST /auth/register-pharmacy  (public — pharmacy owner self-signup with password)
const registerPharmacy = asyncHandler(async (req, res) => {
  const { owner_name, mobile, email, password } = req.body;
  const existing = await db('users').where({ mobile }).first();
  if (existing) throw ApiError.conflict('An account with this mobile already exists. Please log in.');

  const password_hash = await bcrypt.hash(password, 10);
  const [id] = await db('users').insert({
    name: owner_name,
    mobile,
    email: email || null,
    password_hash,
    role: ROLES.PHARMACY_OWNER,
    status: USER_STATUS.ACTIVE,
    is_mobile_verified: true,
    last_login_at: db.fn.now(),
  });
  await db('user_profiles').insert({ user_id: id });

  const user = await db('users').where({ id }).first();
  const tokens = issueTokens(user);
  return created(res, { user: presentUser(user), ...tokens }, 'Account created. Next, register your pharmacy.');
});

// POST /auth/admin-login  (admin / pharmacy / driver web login with password)
const passwordLogin = asyncHandler(async (req, res) => {
  const { mobile, password } = req.body;
  const user = await db('users').where({ mobile }).first();
  if (!user || !user.password_hash) throw ApiError.unauthorized('Invalid credentials');
  if (user.status !== USER_STATUS.ACTIVE) throw ApiError.forbidden('Account is not active');

  const allowedRoles = [ROLES.ADMIN, ROLES.PHARMACY_OWNER, ROLES.PHARMACY_STAFF, ROLES.AMBULANCE_DRIVER];
  if (!allowedRoles.includes(user.role)) throw ApiError.forbidden('Use OTP login for this account');

  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) throw ApiError.unauthorized('Invalid credentials');

  await db('users').where({ id: user.id }).update({ last_login_at: db.fn.now() });
  const tokens = issueTokens(user);
  return ok(res, { user: presentUser(user), ...tokens }, 'Login successful');
});

// Find a user by the identifier for the chosen channel.
async function findUserByChannel(channel, destination) {
  return channel === 'email'
    ? db('users').where({ email: destination }).first()
    : db('users').where({ mobile: destination }).first();
}

// POST /auth/forgot-password/request-otp  { mobile?, email?, channel? }
const forgotPasswordRequestOtp = asyncHandler(async (req, res) => {
  const { mobile, email, channel = 'sms' } = req.body;
  const destination = otpDestination(channel, { mobile, email });
  const user = await findUserByChannel(channel, destination);
  if (!user) throw ApiError.notFound('No account found with these details');
  if (user.status === USER_STATUS.BLOCKED) throw ApiError.forbidden('Your account is blocked');
  // Admin passwords are managed manually, not via self-service reset.
  if (user.role === ROLES.ADMIN) throw ApiError.forbidden('Admin passwords cannot be reset here. Contact the system administrator.');
  const result = await otpService.requestOtp({ channel, destination }, 'reset_password');
  return ok(res, result, 'OTP sent');
});

// POST /auth/forgot-password/reset  { mobile?, email?, channel?, code, newPassword }
const forgotPasswordReset = asyncHandler(async (req, res) => {
  const { mobile, email, channel = 'sms', code, newPassword } = req.body;
  const destination = otpDestination(channel, { mobile, email });
  if (!newPassword || newPassword.length < 6) throw ApiError.badRequest('Password must be at least 6 characters');
  const user = await findUserByChannel(channel, destination);
  if (!user) throw ApiError.notFound('No account found with these details');
  // Admin passwords are managed manually, not via self-service reset.
  if (user.role === ROLES.ADMIN) throw ApiError.forbidden('Admin passwords cannot be reset here.');

  await otpService.verifyOtp({ channel, destination }, code, 'reset_password');
  const password_hash = await bcrypt.hash(newPassword, 10);
  await db('users').where({ id: user.id }).update({ password_hash });
  return ok(res, {}, 'Password reset successful. Please log in with your new password.');
});

// POST /auth/change-password  (authenticated)  { currentPassword, newPassword }
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) throw ApiError.badRequest('New password must be at least 6 characters');
  const user = await db('users').where({ id: req.user.id }).first();
  if (!user.password_hash) throw ApiError.badRequest('Your account has no password set. Use OTP login.');
  const matches = await bcrypt.compare(currentPassword || '', user.password_hash);
  if (!matches) throw ApiError.unauthorized('Current password is incorrect');
  const password_hash = await bcrypt.hash(newPassword, 10);
  await db('users').where({ id: user.id }).update({ password_hash });
  return ok(res, {}, 'Password changed successfully');
});

// POST /auth/refresh
const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw ApiError.badRequest('refreshToken is required');
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (e) {
    throw ApiError.unauthorized('Invalid refresh token');
  }
  const user = await db('users').where({ id: decoded.sub }).first();
  if (!user) throw ApiError.unauthorized('User not found');
  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  return ok(res, { accessToken }, 'Token refreshed');
});

// GET /auth/me
const me = asyncHandler(async (req, res) => {
  const [profile, donor] = await Promise.all([
    db('user_profiles').where({ user_id: req.user.id }).first(),
    db('donor_profiles').where({ user_id: req.user.id }).first(),
  ]);
  return ok(res, { user: presentUser(req.user), profile: profile || null, donor: donor || null });
});

// ---- Aadhaar KYC ------------------------------------------------------

// POST /auth/aadhaar/generate-otp  { aadhaarNumber }
const aadhaarGenerateOtp = asyncHandler(async (req, res) => {
  const { aadhaarNumber } = req.body;
  const { clientRef, last4 } = await aadhaarService.generateOtp(aadhaarNumber);

  // Invalidate any previous in-progress verifications for this user.
  await db('aadhaar_verifications')
    .where({ user_id: req.user.id, status: 'otp_sent' })
    .update({ status: 'failed' });

  const [id] = await db('aadhaar_verifications').insert({
    user_id: req.user.id,
    aadhaar_last4: last4,
    provider: config.aadhaar.provider,
    client_ref: clientRef,
    status: 'otp_sent',
    expires_at: db.raw('DATE_ADD(NOW(), INTERVAL 10 MINUTE)'),
  });

  await db('users').where({ id: req.user.id }).update({ aadhaar_kyc_status: AADHAAR_KYC_STATUS.PENDING });

  return created(res, { verificationId: id, last4, devOtp: config.aadhaar.provider === 'mock' ? config.aadhaar.devOtp : undefined }, 'Aadhaar OTP sent');
});

// POST /auth/aadhaar/verify  { otp }
const aadhaarVerify = asyncHandler(async (req, res) => {
  const { otp } = req.body;
  const record = await db('aadhaar_verifications')
    .where({ user_id: req.user.id, status: 'otp_sent' })
    .andWhere('expires_at', '>', db.raw('NOW()'))
    .orderBy('id', 'desc')
    .first();
  if (!record) throw ApiError.badRequest('No Aadhaar OTP in progress or it expired. Please start again.');

  let result;
  try {
    result = await aadhaarService.submitOtp(record.client_ref, otp);
  } catch (err) {
    throw err;
  }

  await db('aadhaar_verifications').where({ id: record.id }).update({ status: 'verified' });
  await db('users').where({ id: req.user.id }).update({
    aadhaar_kyc_status: AADHAAR_KYC_STATUS.VERIFIED,
    aadhaar_name: result.name || null,
    aadhaar_last4: record.aadhaar_last4,
    aadhaar_verified_at: db.fn.now(),
  });

  const user = await db('users').where({ id: req.user.id }).first();
  return ok(res, { user: presentUser(user) }, 'Aadhaar verified successfully');
});

// ---- Aadhaar manual KYC (photo upload → admin review) -----------------

// POST /auth/aadhaar/manual  (multipart: front, back) — user uploads photos of
// the front and back of their Aadhaar card for an admin to verify manually.
const aadhaarManualSubmit = asyncHandler(async (req, res) => {
  if (req.user.aadhaar_kyc_status === AADHAAR_KYC_STATUS.VERIFIED) {
    throw ApiError.conflict('Your Aadhaar is already verified.');
  }
  const front = req.files?.front?.[0];
  const back = req.files?.back?.[0];
  if (!front || !back) throw ApiError.badRequest('Both front and back photos of your Aadhaar are required.');

  const owner = await db('users').where({ id: req.user.id }).first();
  const frontPath = renameUpload(front, 'aadhaar_docs', [owner?.name, req.user.id, 'aadhaar-front']);
  const backPath = renameUpload(back, 'aadhaar_docs', [owner?.name, req.user.id, 'aadhaar-back']);

  // Supersede any earlier pending submission so only the latest one is reviewed.
  await db('aadhaar_kyc_submissions')
    .where({ user_id: req.user.id, status: 'pending' })
    .update({ status: 'rejected', rejection_reason: 'Superseded by a newer submission', reviewed_at: db.fn.now() });

  const [id] = await db('aadhaar_kyc_submissions').insert({
    user_id: req.user.id,
    front_url: frontPath,
    back_url: backPath,
    status: 'pending',
  });

  await db('users').where({ id: req.user.id }).update({ aadhaar_kyc_status: AADHAAR_KYC_STATUS.PENDING });

  const row = await db('aadhaar_kyc_submissions').where({ id }).first();
  return created(res, {
    id: row.id,
    status: row.status,
    front_url: fileUrl(row.front_url),
    back_url: fileUrl(row.back_url),
    created_at: row.created_at,
  }, 'Aadhaar submitted for verification');
});

// GET /auth/aadhaar/manual/status — latest manual submission + current KYC state.
const aadhaarManualStatus = asyncHandler(async (req, res) => {
  const submission = await db('aadhaar_kyc_submissions')
    .where({ user_id: req.user.id })
    .orderBy('id', 'desc')
    .first();
  return ok(res, {
    kyc_status: req.user.aadhaar_kyc_status,
    submission: submission
      ? {
        id: submission.id,
        status: submission.status,
        rejection_reason: submission.rejection_reason,
        created_at: submission.created_at,
        reviewed_at: submission.reviewed_at,
      }
      : null,
  });
});

module.exports = {
  requestOtp,
  verifyOtp,
  register,
  loginEmail,
  registerPharmacy,
  passwordLogin,
  forgotPasswordRequestOtp,
  forgotPasswordReset,
  changePassword,
  refresh,
  me,
  aadhaarGenerateOtp,
  aadhaarVerify,
  aadhaarManualSubmit,
  aadhaarManualStatus,
};
