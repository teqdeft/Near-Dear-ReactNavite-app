/**
 * Add a city to ambulance requests so the booking can be routed to nearby
 * (same-city) drivers. True GPS-nearest routing can replace this later.
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('ambulance_requests', (t) => {
    t.string('city', 120).nullable().after('drop_address');
    t.index(['city']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('ambulance_requests', (t) => {
    t.dropIndex(['city']);
    t.dropColumn('city');
  });
};
