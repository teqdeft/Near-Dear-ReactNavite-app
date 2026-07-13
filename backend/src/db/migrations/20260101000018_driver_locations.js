/**
 * Where each ambulance driver last was, so a request can reach drivers who are
 * physically near the pickup — not only those whose profile city happens to name
 * the same town.
 *
 * One row per driver, overwritten in place. There is no history: matching only
 * ever asks "where are you now", and keeping a trail of every driver's movements
 * is data we would have to justify holding.
 *
 * `updated_at` is load-bearing, not bookkeeping. A location from three hours ago
 * says nothing about where the ambulance is now, so the matcher ignores stale
 * rows and falls back to city matching. Without the timestamp we would confidently
 * dispatch to a driver who left the city at lunchtime.
 *
 * `is_on_duty` is the driver's own switch. It exists because tracking someone's
 * location while they are off shift is not ours to do.
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('driver_locations', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('driver_user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    t.decimal('latitude', 10, 7).nullable();
    t.decimal('longitude', 10, 7).nullable();
    t.boolean('is_on_duty').notNullable().defaultTo(false);
    t.timestamp('updated_at').nullable();

    // One row per driver — the upsert on every ping depends on this.
    t.unique(['driver_user_id']);
    // Matching reads only on-duty drivers.
    t.index(['is_on_duty']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('driver_locations');
};
