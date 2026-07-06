/**
 * Flag on the user for when they request account deletion, so an admin can see
 * and action the request from the Users dashboard.
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable('users', (t) => {
    t.timestamp('deletion_requested_at').nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('deletion_requested_at');
  });
};
