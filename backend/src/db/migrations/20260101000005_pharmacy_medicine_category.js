/**
 * Pharmacy-owned medicine listings can now carry a category directly.
 *
 * Categories previously lived only on the master `medicines` table, so a
 * custom listing (custom_name, no medicine_id) had no category and never
 * showed up under a category filter in the mobile app. This column lets the
 * pharmacy owner tag each listing so it surfaces in the right category.
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable('pharmacy_medicines', (t) => {
    t.bigInteger('category_id').unsigned().nullable()
      .references('id').inTable('medicine_categories').onDelete('SET NULL');
    t.index(['category_id']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('pharmacy_medicines', (t) => {
    t.dropColumn('category_id');
  });
};
