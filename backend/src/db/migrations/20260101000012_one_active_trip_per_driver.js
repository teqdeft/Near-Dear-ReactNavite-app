/**
 * Airtight guarantee that a driver can run only ONE ambulance trip at a time
 * (an ambulance carries a single patient). The controller already blocks a
 * second accept, but two near-simultaneous accepts could slip past that check.
 *
 * MySQL has no partial/filtered unique index, so we use the classic workaround:
 * a VIRTUAL generated column that holds the driver id ONLY while the trip is
 * live (accepted / on_the_way / picked_up) and NULL otherwise. A unique index
 * on it enforces one live row per driver — MySQL allows many NULLs, so
 * completed/cancelled/unassigned rows never collide.
 */

exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE ambulance_requests
    ADD COLUMN active_driver_lock BIGINT UNSIGNED
      GENERATED ALWAYS AS (
        CASE WHEN status IN ('accepted','on_the_way','picked_up')
             THEN assigned_driver_id ELSE NULL END
      ) VIRTUAL
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX uq_amb_one_active_trip_per_driver
    ON ambulance_requests (active_driver_lock)
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP INDEX uq_amb_one_active_trip_per_driver ON ambulance_requests');
  await knex.raw('ALTER TABLE ambulance_requests DROP COLUMN active_driver_lock');
};
