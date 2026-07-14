/**
 * FCM registration tokens — the addresses push notifications are actually sent to.
 *
 * A token identifies an app *installation*, not a user, so the shape is one row
 * per (user, device): a user with a phone and a tablet gets two rows, and every
 * one of them should ring.
 *
 * The unique key is on `token` alone, not on (user_id, token). Firebase hands the
 * same token to whoever is logged in on that installation, so when a second user
 * signs in on a borrowed phone the row must MOVE to them, not be duplicated —
 * otherwise the first user keeps receiving notifications on a phone they no longer
 * hold. Registration upserts on `token` and overwrites `user_id` for exactly this
 * reason.
 *
 * Tokens expire, get reissued after a reinstall, and go stale when an app is
 * uninstalled. FCM reports these back as UNREGISTERED/INVALID_ARGUMENT on send,
 * and the sender deletes the row — so this table prunes itself rather than growing
 * a tail of dead addresses forever.
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('device_tokens', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');

    // FCM tokens run ~160 chars today, but Google documents no maximum and has
    // lengthened them before. TEXT costs nothing here and cannot silently
    // truncate an address, which would fail sends in a way that looks like a
    // delivery bug rather than a schema one.
    t.text('token').notNullable();
    t.enu('platform', ['android', 'ios']).notNullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // MySQL cannot put a plain unique index on TEXT, so key the first 191 chars —
    // enough to be unique in practice, and the prefix length MySQL allows under
    // utf8mb4's 767-byte index limit.
    t.unique([knex.raw('token(191)')], { indexName: 'device_tokens_token_unique' });

    // Every send starts by asking "which tokens does this user have".
    t.index(['user_id']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('device_tokens');
};
