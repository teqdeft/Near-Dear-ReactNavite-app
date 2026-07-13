/**
 * A donor lists every city they can reach to donate ("Mohali, Kharar,
 * Chandigarh") — neighbouring towns are a short drive apart, and a request in
 * any of them should reach them. VARCHAR(120) only fits a couple, so widen it.
 * (blood_requests.city stays 120 — a request names one hospital, in one city.)
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('donor_profiles', (t) => {
    t.string('city', 255).notNullable().alter();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('donor_profiles', (t) => {
    t.string('city', 120).notNullable().alter();
  });
};
