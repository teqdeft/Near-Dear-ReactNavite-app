const ApiError = require('./ApiError');
const { AADHAAR_KYC_STATUS } = require('../constants/enums');

/**
 * Guard an action behind a verified Aadhaar (KYC) identity.
 * Throws 403 if the current user hasn't completed KYC.
 */
function requireKyc(req, actionMsg = 'donate or request blood') {
  if (req.user.aadhaar_kyc_status !== AADHAAR_KYC_STATUS.VERIFIED) {
    throw ApiError.forbidden(`Please complete Aadhaar (KYC) verification before you can ${actionMsg}.`);
  }
}

module.exports = { requireKyc };
