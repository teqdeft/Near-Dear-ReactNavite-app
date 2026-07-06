/**
 * Bug fix: `otp_codes.expires_at` was a TIMESTAMP column and — being the first
 * timestamp column without an explicit default — MySQL silently gave it
 * `ON UPDATE CURRENT_TIMESTAMP`. So incrementing `attempts` on a wrong OTP also
 * reset `expires_at` to NOW(), instantly expiring the code (one wrong try killed
 * the OTP). Converting to DATETIME removes that implicit behaviour.
 *
 * `aadhaar_verifications.expires_at` has the same shape and is fixed too.
 */

exports.up = async function up(knex) {
  await knex.raw('ALTER TABLE otp_codes MODIFY expires_at DATETIME NOT NULL');
  await knex.raw('ALTER TABLE aadhaar_verifications MODIFY expires_at DATETIME NULL');
};

exports.down = async function down(knex) {
  await knex.raw('ALTER TABLE otp_codes MODIFY expires_at TIMESTAMP NOT NULL');
  await knex.raw('ALTER TABLE aadhaar_verifications MODIFY expires_at TIMESTAMP NULL');
};
