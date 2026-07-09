/**
 * Manual Aadhaar KYC: instead of the automated Surepass OTP flow, a user can
 * upload photos of the front and back of their Aadhaar card, which an admin then
 * reviews and approves/rejects — mirrors the pharmacy / ambulance approval flow.
 * The Surepass OTP path stays available; this is a parallel, admin-driven route.
 */

exports.up = async function up(knex) {
  await knex.schema.createTable('aadhaar_kyc_submissions', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('front_url', 500).notNullable();
    t.string('back_url', 500).notNullable();
    t.enu('status', ['pending', 'approved', 'rejected']).notNullable().defaultTo('pending');
    t.text('rejection_reason').nullable();
    t.bigInteger('reviewed_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('reviewed_at').nullable();
    t.timestamps(true, true);
    t.index(['user_id']);
    t.index(['status']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('aadhaar_kyc_submissions');
};
