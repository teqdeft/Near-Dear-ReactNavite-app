/**
 * Extend the one-active-trip-per-driver lock to also cover ADMIN-assigned trips.
 *
 * Migration 000012 only counted a trip as "live" for statuses accepted /
 * on_the_way / picked_up. But an admin can assign a driver via assignAmbulance,
 * which sets status = 'assigned' — that slipped past the lock, so an
 * admin-assigned trip and a driver-accepted trip could coexist for one driver.
 * Here we rebuild the generated column to include 'assigned'.
 */

exports.up = async function up(knex) {
  await knex.raw('DROP INDEX uq_amb_one_active_trip_per_driver ON ambulance_requests');
  await knex.raw('ALTER TABLE ambulance_requests DROP COLUMN active_driver_lock');
  await knex.raw(`
    ALTER TABLE ambulance_requests
    ADD COLUMN active_driver_lock BIGINT UNSIGNED
      GENERATED ALWAYS AS (
        CASE WHEN status IN ('assigned','accepted','on_the_way','picked_up')
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
