const bcrypt = require('bcryptjs');
const axios = require('axios');
const db = require('../db/knex');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const emailService = require('./emailService');

const MAX_ATTEMPTS = 5;

function genCode() {
  // 6-digit numeric OTP.
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Expiry is computed and compared in the DB (NOW()) to avoid JS/MySQL
// timezone mismatches when timestamps are read back as strings.
function expiryExpr() {
  return db.raw('DATE_ADD(NOW(), INTERVAL ? MINUTE)', [config.otp.expiryMinutes]);
}

/**
 * Send the OTP via the configured provider.
 * - mock: nothing is sent; the dev code (OTP_DEV_CODE) always works.
 * - msg91: real SMS via MSG91 OTP API.
 * Returns the code that should be stored/verified.
 */
async function deliverOtp(channel, destination) {
  if (config.otp.provider === 'mock') {
    // In mock mode we accept the configured dev code, so "store" that.
    // (Email is logged by emailService, SMS isn't sent at all.)
    if (channel === 'email') await emailService.sendOtpEmail(destination, config.otp.devCode);
    return config.otp.devCode;
  }

  // Real provider: generate a random code and send it.
  const code = genCode();

  if (channel === 'email') {
    await emailService.sendOtpEmail(destination, code);
    return code;
  }

  const mobile = destination;
  if (config.otp.provider === 'msg91') {
    const { authKey, templateId, senderId } = config.otp.msg91;
    if (!authKey || !templateId) {
      throw ApiError.badRequest(
        'MSG91 is selected but MSG91_AUTH_KEY / MSG91_OTP_TEMPLATE_ID are missing in .env'
      );
    }
    // MSG91 OTP API v5. Mobile must include country code (India = 91).
    const mobileWithCc = mobile.startsWith('91') ? mobile : `91${mobile}`;
    await axios.post(
      'https://control.msg91.com/api/v5/otp',
      { otp: code, sender: senderId },
      {
        params: { template_id: templateId, mobile: mobileWithCc, authkey: authKey },
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );
    return code;
  }

  throw ApiError.badRequest(`Unknown OTP_PROVIDER: ${config.otp.provider}`);
}

/**
 * Create + send an OTP to a destination over a channel.
 * @param {{channel?: 'sms'|'email', destination: string}} target
 */
async function requestOtp({ channel = 'sms', destination }, purpose = 'login') {
  if (!destination) throw ApiError.badRequest('A phone number or email is required');
  const code = await deliverOtp(channel, destination);
  const codeHash = await bcrypt.hash(code, 10);

  // Invalidate previous unconsumed codes for this destination/purpose.
  await db('otp_codes').where({ destination, purpose, consumed: false }).update({ consumed: true });

  await db('otp_codes').insert({
    channel,
    destination,
    mobile: channel === 'sms' ? destination : null,
    purpose,
    code_hash: codeHash,
    expires_at: expiryExpr(),
  });

  // In dev/mock we surface the code so the app can be tested without a real SMS/email.
  const devCode = config.otp.provider === 'mock' ? config.otp.devCode : undefined;
  return { sent: true, channel, devCode };
}

/**
 * Verify an OTP. Throws ApiError on failure. Marks the code consumed on success.
 * @param {{channel?: 'sms'|'email', destination: string}} target
 */
async function verifyOtp({ destination }, code, purpose = 'login') {
  const row = await db('otp_codes')
    .where({ destination, purpose, consumed: false })
    .andWhere('expires_at', '>', db.raw('NOW()'))
    .orderBy('id', 'desc')
    .first();

  if (!row) throw ApiError.badRequest('OTP expired or not requested. Please request a new code.');
  if (row.attempts >= MAX_ATTEMPTS) {
    throw ApiError.badRequest('Too many incorrect attempts. Please request a new code.');
  }

  const matches = await bcrypt.compare(String(code), row.code_hash);
  if (!matches) {
    await db('otp_codes').where({ id: row.id }).increment('attempts', 1);
    throw ApiError.badRequest('Incorrect OTP.');
  }

  await db('otp_codes').where({ id: row.id }).update({ consumed: true });
  return true;
}

module.exports = { requestOtp, verifyOtp };
