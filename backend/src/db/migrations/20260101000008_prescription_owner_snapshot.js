/**
 * Snapshot the uploader's name + mobile onto the prescription at upload time,
 * so a prescription stays identifiable even if the user later changes their
 * profile name/number (same pattern as medicine_order_items snapshots).
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable('prescriptions', (t) => {
    t.string('patient_name_snapshot', 160).nullable();
    t.string('patient_mobile_snapshot', 20).nullable();
  });

  // Backfill existing rows from the current user record.
  await knex.raw(`
    UPDATE prescriptions p
    JOIN users u ON u.id = p.user_id
    SET p.patient_name_snapshot = u.name,
        p.patient_mobile_snapshot = u.mobile
    WHERE p.patient_name_snapshot IS NULL
  `);
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('prescriptions', (t) => {
    t.dropColumn('patient_name_snapshot');
    t.dropColumn('patient_mobile_snapshot');
  });
};
