/**
 * Ambulance drivers now self-register their vehicle and upload documents
 * (RC, licence, permit, insurance…) which an admin must approve before the
 * driver can accept rides — mirrors the pharmacy approval flow.
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable('ambulances', (t) => {
    t.enu('approval_status', ['pending', 'approved', 'rejected']).notNullable().defaultTo('pending');
    t.text('rejection_reason').nullable();
    t.bigInteger('approved_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('approved_at').nullable();
  });

  // Vehicles that already existed were added by an admin — treat them approved.
  await knex('ambulances').update({ approval_status: 'approved' });

  await knex.schema.createTable('ambulance_documents', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('ambulance_id').unsigned().notNullable().references('id').inTable('ambulances').onDelete('CASCADE');
    t.enu('document_type', ['rc', 'driving_license', 'permit', 'insurance', 'vehicle_photo', 'other']).notNullable().defaultTo('other');
    t.string('file_url', 500).notNullable();
    t.enu('status', ['pending', 'approved', 'rejected']).notNullable().defaultTo('pending');
    t.timestamps(true, true);
    t.index(['ambulance_id']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('ambulance_documents');
  await knex.schema.alterTable('ambulances', (t) => {
    t.dropColumn('approval_status');
    t.dropColumn('rejection_reason');
    t.dropColumn('approved_by');
    t.dropColumn('approved_at');
  });
};
