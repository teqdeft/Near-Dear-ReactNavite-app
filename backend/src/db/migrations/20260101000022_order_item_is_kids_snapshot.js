/**
 * Order items snapshot the kids flag at purchase time, same as name/price.
 *
 * Joining the live listing would lie later: the pharmacy can re-tag or delete
 * the listing (pharmacy_medicine_id is SET NULL on delete), and the order
 * detail must keep showing what was true when the customer ordered it.
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable('medicine_order_items', (t) => {
    t.boolean('is_kids').notNullable().defaultTo(false);
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('medicine_order_items', (t) => {
    t.dropColumn('is_kids');
  });
};
