/**
 * Per-stage timestamps for an ambulance trip.
 *
 * Until now `ambulance_requests` only had created_at (when it was requested) and
 * updated_at (the LAST change), so the trip timeline could not show WHEN each
 * stage actually happened. These nullable columns record the moment a trip
 * enters each stage, written with the DB clock (UTC — the MySQL session is
 * pinned to UTC in knexfile.js) so the app can render them in the device's
 * local timezone.
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable('ambulance_requests', (t) => {
    t.timestamp('assigned_at').nullable();
    t.timestamp('accepted_at').nullable();
    t.timestamp('on_the_way_at').nullable();
    t.timestamp('picked_up_at').nullable();
    t.timestamp('completed_at').nullable();
    t.timestamp('cancelled_at').nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('ambulance_requests', (t) => {
    t.dropColumn('assigned_at');
    t.dropColumn('accepted_at');
    t.dropColumn('on_the_way_at');
    t.dropColumn('picked_up_at');
    t.dropColumn('completed_at');
    t.dropColumn('cancelled_at');
  });
};
