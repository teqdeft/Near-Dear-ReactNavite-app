/**
 * Blood notifications were all a single 'blood' type, but they target two
 * different audiences: donors (a request near them) and the requester (a donor
 * accepted their request). The mobile app routes by type, so a requester who is
 * also a donor was sent to the "Requests for me" list instead of their own
 * request. Add a dedicated 'blood_accepted' type for the requester-facing case
 * so routing is unambiguous.
 */

exports.up = async function up(knex) {
  await knex.raw(
    "ALTER TABLE notifications MODIFY COLUMN type "
    + "ENUM('blood','medicine_order','ambulance','admin','support','blood_accepted') "
    + "NOT NULL DEFAULT 'admin'"
  );
};

exports.down = async function down(knex) {
  // Fold the new type back into 'blood' before shrinking the enum, so no row
  // holds a value the column can no longer represent.
  await knex('notifications').where({ type: 'blood_accepted' }).update({ type: 'blood' });
  await knex.raw(
    "ALTER TABLE notifications MODIFY COLUMN type "
    + "ENUM('blood','medicine_order','ambulance','admin','support') "
    + "NOT NULL DEFAULT 'admin'"
  );
};
