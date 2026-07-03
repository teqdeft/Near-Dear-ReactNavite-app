/**
 * OTP can now be delivered over SMS or email, and can be used to reset a
 * forgotten password.
 *
 * - channel: how the code was delivered ('sms' | 'email').
 * - destination: the phone or email the code was sent to (email needs > 20
 *   chars, so `mobile` alone can't hold it).
 * - mobile: made nullable (email-only OTPs have no phone).
 * - purpose: adds 'reset_password'.
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable('otp_codes', (t) => {
    t.enu('channel', ['sms', 'email']).notNullable().defaultTo('sms');
    t.string('destination', 191).nullable();
    t.string('mobile', 20).nullable().alter();
    t.enu('purpose', ['login', 'mobile_verify', 'reset_password']).notNullable().defaultTo('login').alter();
    t.index(['destination', 'purpose']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('otp_codes', (t) => {
    t.dropIndex(['destination', 'purpose']);
    t.dropColumn('channel');
    t.dropColumn('destination');
    t.enu('purpose', ['login', 'mobile_verify']).notNullable().defaultTo('login').alter();
    // mobile intentionally left nullable on rollback (harmless).
  });
};
