/**
 * Email is now used for password login, so it must be unique.
 * MySQL allows multiple NULLs in a unique index, so OTP-only users (no email) are fine.
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('users', (t) => {
    t.unique(['email'], { indexName: 'users_email_unique' });
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('users', (t) => {
    t.dropUnique(['email'], 'users_email_unique');
  });
};
