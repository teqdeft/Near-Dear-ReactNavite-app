/**
 * Ambulance drivers list every city they can serve ("Mohali, Kharar,
 * Chandigarh"), not just the one they live in — `citiesOverlap` already matches
 * a request against any city in the field, but VARCHAR(120) only fits a handful.
 * Widen it so a driver can cover a realistic service area.
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('user_profiles', (t) => {
    t.string('city', 255).nullable().alter();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('user_profiles', (t) => {
    t.string('city', 120).nullable().alter();
  });
};
