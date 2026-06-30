const axios = require('axios');
const config = require('../config');
const ApiError = require('../utils/ApiError');

/**
 * Aadhaar OTP-based KYC.
 *
 *   provider = 'mock'     -> no external call; AADHAAR_DEV_OTP is accepted.
 *   provider = 'surepass' -> real Surepass Aadhaar v2 OTP KYC.
 *
 * Compliance: we only ever return/store the masked Aadhaar (last 4 digits)
 * and the verified name + a provider reference. The full number is never stored.
 */

const AADHAAR_REGEX = /^\d{12}$/;

function assertValidAadhaar(aadhaarNumber) {
  const clean = String(aadhaarNumber || '').replace(/\s+/g, '');
  if (!AADHAAR_REGEX.test(clean)) {
    throw ApiError.badRequest('Aadhaar number must be exactly 12 digits.');
  }
  return clean;
}

function surepassClient() {
  const { baseUrl, token } = config.aadhaar.surepass;
  if (!token) {
    throw ApiError.badRequest('Surepass selected but SUREPASS_TOKEN is missing in .env');
  }
  return axios.create({
    baseURL: baseUrl,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    timeout: 20000,
  });
}

/**
 * Step 1 — send an OTP to the mobile linked with the Aadhaar number.
 * Returns { clientRef, last4 }.
 */
async function generateOtp(aadhaarNumber) {
  const clean = assertValidAadhaar(aadhaarNumber);
  const last4 = clean.slice(-4);

  if (config.aadhaar.provider === 'mock') {
    // Simulated reference; submit step will accept AADHAAR_DEV_OTP.
    return { clientRef: `mock_${last4}_${Date.now()}`, last4 };
  }

  if (config.aadhaar.provider === 'surepass') {
    try {
      const client = surepassClient();
      const { data } = await client.post('/api/v1/aadhaar-v2/generate-otp', { id_number: clean });
      const clientRef = data?.data?.client_id;
      if (!clientRef) throw new Error('Surepass did not return a client_id');
      return { clientRef, last4 };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      throw ApiError.badRequest(`Aadhaar OTP request failed: ${msg}`);
    }
  }

  throw ApiError.badRequest(`Unknown AADHAAR_PROVIDER: ${config.aadhaar.provider}`);
}

/**
 * Step 2 — submit the OTP. Returns { verified, name }.
 */
async function submitOtp(clientRef, otp) {
  if (!clientRef) throw ApiError.badRequest('Missing Aadhaar verification reference.');

  if (config.aadhaar.provider === 'mock') {
    if (String(otp) !== config.aadhaar.devOtp) {
      throw ApiError.badRequest('Incorrect Aadhaar OTP.');
    }
    return { verified: true, name: 'Verified User (mock)' };
  }

  if (config.aadhaar.provider === 'surepass') {
    try {
      const client = surepassClient();
      const { data } = await client.post('/api/v1/aadhaar-v2/submit-otp', {
        client_id: clientRef,
        otp: String(otp),
      });
      const profile = data?.data || {};
      return { verified: true, name: profile.full_name || null };
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      throw ApiError.badRequest(`Aadhaar verification failed: ${msg}`);
    }
  }

  throw ApiError.badRequest(`Unknown AADHAAR_PROVIDER: ${config.aadhaar.provider}`);
}

module.exports = { generateOtp, submitOtp, assertValidAadhaar };
