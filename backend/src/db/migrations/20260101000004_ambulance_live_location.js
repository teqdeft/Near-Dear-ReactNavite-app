/**
 * Live ambulance tracking (REST short-polling).
 * Adds the driver's latest GPS position to each ambulance request/trip.
 * The assigned driver POSTs coordinates every few seconds while the trip is
 * active; the requesting user polls them to animate the ambulance marker.
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable('ambulance_requests', (t) => {
    t.decimal('current_latitude', 10, 7).nullable();
    t.decimal('current_longitude', 10, 7).nullable();
    t.decimal('bearing', 5, 2).nullable(); // compass heading in degrees (0-360)
    t.timestamp('location_updated_at').nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('ambulance_requests', (t) => {
    t.dropColumn('current_latitude');
    t.dropColumn('current_longitude');
    t.dropColumn('bearing');
    t.dropColumn('location_updated_at');
  });
};
