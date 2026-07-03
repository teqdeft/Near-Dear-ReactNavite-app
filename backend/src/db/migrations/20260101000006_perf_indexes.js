/**
 * Performance indexes for high-frequency owner/driver lookups.
 *
 * - pharmacies.owner_user_id: hit on nearly every pharmacy-owner request
 *   (ownedPharmacy lookup), previously unindexed.
 * - ambulances.driver_user_id: used when a driver accepts a request and in
 *   driver lookups, previously unindexed.
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable('pharmacies', (t) => {
    t.index(['owner_user_id']);
  });
  await knex.schema.alterTable('ambulances', (t) => {
    t.index(['driver_user_id']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('pharmacies', (t) => {
    t.dropIndex(['owner_user_id']);
  });
  await knex.schema.alterTable('ambulances', (t) => {
    t.dropIndex(['driver_user_id']);
  });
};
