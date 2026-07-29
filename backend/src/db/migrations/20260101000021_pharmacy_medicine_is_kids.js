/**
 * Kids section: a listing-level flag rather than a category.
 *
 * A kids medicine still belongs to a real category (a kids paracetamol syrup
 * is still "Fever & Pain Relief"), so "kids" is a second dimension the owner
 * tags per listing. The app combines both filters: the Kids store shows only
 * flagged listings, grouped by their normal categories.
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable('pharmacy_medicines', (t) => {
    t.boolean('is_kids').notNullable().defaultTo(false);
    t.index(['is_kids']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('pharmacy_medicines', (t) => {
    t.dropColumn('is_kids');
  });
};
