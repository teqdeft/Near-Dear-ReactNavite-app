/**
 * NearDear MVP initial schema (Database Schema section 7 of the blueprint)
 * plus auth helper tables (otp_codes, aadhaar_verifications).
 * Uses BIGINT UNSIGNED auto-increment primary keys.
 */

const E = require('../../constants/enums');

exports.up = async function up(knex) {
  // 7.1 users -------------------------------------------------------------
  await knex.schema.createTable('users', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.string('name', 120).nullable();
    t.string('mobile', 20).notNullable().unique();
    t.string('email', 160).nullable();
    t.string('password_hash', 255).nullable();
    t.enu('role', E.vals(E.ROLES)).notNullable().defaultTo(E.ROLES.USER);
    t.enu('status', E.vals(E.USER_STATUS)).notNullable().defaultTo(E.USER_STATUS.ACTIVE);
    t.boolean('is_mobile_verified').notNullable().defaultTo(false);
    // Aadhaar KYC (compliance: we never store the full Aadhaar number).
    t.enu('aadhaar_kyc_status', E.vals(E.AADHAAR_KYC_STATUS)).notNullable().defaultTo(E.AADHAAR_KYC_STATUS.NONE);
    t.string('aadhaar_name', 160).nullable();
    t.string('aadhaar_last4', 4).nullable();
    t.string('aadhaar_reference_id', 80).nullable();
    t.timestamp('aadhaar_verified_at').nullable();
    t.timestamp('last_login_at').nullable();
    t.timestamps(true, true);
    t.index(['role']);
    t.index(['status']);
  });

  // 7.2 user_profiles -----------------------------------------------------
  await knex.schema.createTable('user_profiles', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.enu('gender', ['male', 'female', 'other']).nullable();
    t.integer('age').nullable();
    t.date('date_of_birth').nullable();
    t.string('blood_group', 4).nullable();
    t.string('city', 120).nullable();
    t.string('state', 120).nullable();
    t.string('pincode', 12).nullable();
    t.string('profile_image', 255).nullable();
    t.string('emergency_contact_name', 120).nullable();
    t.string('emergency_contact_mobile', 20).nullable();
    t.timestamps(true, true);
    t.unique(['user_id']);
  });

  // 7.3 user_addresses ----------------------------------------------------
  await knex.schema.createTable('user_addresses', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.enu('address_type', E.vals(E.ADDRESS_TYPE)).notNullable().defaultTo(E.ADDRESS_TYPE.HOME);
    t.string('name', 120).nullable();
    t.text('address_line_1').notNullable();
    t.text('address_line_2').nullable();
    t.string('city', 120).notNullable();
    t.string('state', 120).nullable();
    t.string('pincode', 12).nullable();
    t.decimal('latitude', 10, 7).nullable();
    t.decimal('longitude', 10, 7).nullable();
    t.boolean('is_default').notNullable().defaultTo(false);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index(['user_id']);
  });

  // 7.4 donor_profiles ----------------------------------------------------
  await knex.schema.createTable('donor_profiles', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('blood_group', 4).notNullable();
    t.string('city', 120).notNullable();
    t.string('pincode', 12).nullable();
    t.decimal('latitude', 10, 7).nullable();
    t.decimal('longitude', 10, 7).nullable();
    t.date('last_donation_date').nullable();
    t.boolean('is_available').notNullable().defaultTo(true);
    t.boolean('can_receive_alerts').notNullable().defaultTo(true);
    t.boolean('health_declaration').notNullable().defaultTo(false);
    t.boolean('consent_accepted').notNullable().defaultTo(false);
    t.enu('status', E.vals(E.DONOR_STATUS)).notNullable().defaultTo(E.DONOR_STATUS.ACTIVE);
    t.timestamps(true, true);
    t.unique(['user_id']);
    t.index(['blood_group', 'city']);
    t.index(['is_available']);
  });

  // 7.5 blood_requests ----------------------------------------------------
  await knex.schema.createTable('blood_requests', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('requester_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('patient_name', 120).notNullable();
    t.integer('patient_age').nullable();
    t.string('blood_group_required', 4).notNullable();
    t.integer('units_required').notNullable().defaultTo(1);
    t.string('hospital_name', 180).notNullable();
    t.text('hospital_address').notNullable();
    t.string('city', 120).notNullable();
    t.string('state', 120).nullable();
    t.string('pincode', 12).nullable();
    t.decimal('latitude', 10, 7).nullable();
    t.decimal('longitude', 10, 7).nullable();
    t.timestamp('required_at').nullable();
    t.enu('urgency_level', E.vals(E.URGENCY)).notNullable().defaultTo(E.URGENCY.NORMAL);
    t.string('contact_person_name', 120).notNullable();
    t.string('contact_person_mobile', 20).notNullable();
    t.text('notes').nullable();
    t.enu('status', E.vals(E.BLOOD_REQUEST_STATUS)).notNullable().defaultTo(E.BLOOD_REQUEST_STATUS.OPEN);
    t.timestamps(true, true);
    t.index(['blood_group_required', 'city']);
    t.index(['status']);
  });

  // 7.6 blood_request_matches --------------------------------------------
  await knex.schema.createTable('blood_request_matches', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('blood_request_id').unsigned().notNullable().references('id').inTable('blood_requests').onDelete('CASCADE');
    t.bigInteger('donor_user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.bigInteger('donor_profile_id').unsigned().notNullable().references('id').inTable('donor_profiles').onDelete('CASCADE');
    t.boolean('notification_sent').notNullable().defaultTo(false);
    t.enu('response_status', E.vals(E.MATCH_RESPONSE)).notNullable().defaultTo(E.MATCH_RESPONSE.PENDING);
    t.timestamp('responded_at').nullable();
    t.boolean('contact_shared').notNullable().defaultTo(false);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.unique(['blood_request_id', 'donor_user_id']);
    t.index(['donor_user_id']);
  });

  // 7.7 pharmacies --------------------------------------------------------
  await knex.schema.createTable('pharmacies', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('owner_user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('pharmacy_name', 180).notNullable();
    t.string('owner_name', 120).notNullable();
    t.string('mobile', 20).notNullable();
    t.string('email', 160).nullable();
    t.string('license_number', 120).notNullable();
    t.string('gst_number', 40).nullable();
    t.text('address').notNullable();
    t.string('city', 120).notNullable();
    t.string('state', 120).nullable();
    t.string('pincode', 12).nullable();
    t.decimal('latitude', 10, 7).nullable();
    t.decimal('longitude', 10, 7).nullable();
    t.enu('approval_status', E.vals(E.PHARMACY_APPROVAL)).notNullable().defaultTo(E.PHARMACY_APPROVAL.PENDING);
    t.text('rejection_reason').nullable();
    t.bigInteger('approved_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('approved_at').nullable();
    t.timestamps(true, true);
    t.index(['approval_status']);
    t.index(['city']);
  });

  // 7.8 pharmacy_documents ------------------------------------------------
  await knex.schema.createTable('pharmacy_documents', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('pharmacy_id').unsigned().notNullable().references('id').inTable('pharmacies').onDelete('CASCADE');
    t.enu('document_type', E.vals(E.DOC_TYPE)).notNullable();
    t.string('file_url', 500).notNullable();
    t.enu('status', E.vals(E.DOC_STATUS)).notNullable().defaultTo(E.DOC_STATUS.PENDING);
    t.text('rejection_reason').nullable();
    t.timestamp('uploaded_at').defaultTo(knex.fn.now());
    t.bigInteger('reviewed_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('reviewed_at').nullable();
    t.index(['pharmacy_id']);
  });

  // 7.9 medicine_categories ----------------------------------------------
  await knex.schema.createTable('medicine_categories', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.string('name', 120).notNullable();
    t.string('slug', 140).notNullable().unique();
    t.enu('status', E.vals(E.ACTIVE_STATUS)).notNullable().defaultTo(E.ACTIVE_STATUS.ACTIVE);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 7.10 medicines --------------------------------------------------------
  await knex.schema.createTable('medicines', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('category_id').unsigned().nullable().references('id').inTable('medicine_categories').onDelete('SET NULL');
    t.string('name', 180).notNullable();
    t.string('brand_name', 180).nullable();
    t.text('composition').nullable();
    t.string('strength', 60).nullable();
    t.enu('form', E.vals(E.MEDICINE_FORM)).notNullable().defaultTo(E.MEDICINE_FORM.TABLET);
    t.boolean('prescription_required').notNullable().defaultTo(false);
    t.string('image_url', 500).nullable();
    t.enu('status', E.vals(E.ACTIVE_STATUS)).notNullable().defaultTo(E.ACTIVE_STATUS.ACTIVE);
    t.timestamps(true, true);
    t.index(['category_id']);
    t.index(['name']);
  });

  // 7.11 pharmacy_medicines ----------------------------------------------
  await knex.schema.createTable('pharmacy_medicines', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('pharmacy_id').unsigned().notNullable().references('id').inTable('pharmacies').onDelete('CASCADE');
    t.bigInteger('medicine_id').unsigned().nullable().references('id').inTable('medicines').onDelete('SET NULL');
    t.string('custom_name', 180).nullable();
    t.decimal('price', 10, 2).notNullable().defaultTo(0);
    t.decimal('mrp', 10, 2).nullable();
    t.enu('stock_status', E.vals(E.STOCK_STATUS)).notNullable().defaultTo(E.STOCK_STATUS.IN_STOCK);
    t.integer('quantity_available').nullable();
    t.boolean('prescription_required').notNullable().defaultTo(false);
    t.enu('status', E.vals(E.ACTIVE_STATUS)).notNullable().defaultTo(E.ACTIVE_STATUS.ACTIVE);
    t.timestamps(true, true);
    t.index(['pharmacy_id']);
    t.index(['medicine_id']);
  });

  // 7.12 prescriptions ----------------------------------------------------
  await knex.schema.createTable('prescriptions', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('file_url', 500).notNullable();
    t.string('doctor_name', 160).nullable();
    t.date('prescription_date').nullable();
    t.enu('status', E.vals(E.PRESCRIPTION_STATUS)).notNullable().defaultTo(E.PRESCRIPTION_STATUS.UPLOADED);
    t.bigInteger('reviewed_by_pharmacy_id').unsigned().nullable().references('id').inTable('pharmacies').onDelete('SET NULL');
    t.text('rejection_reason').nullable();
    t.timestamps(true, true);
    t.index(['user_id']);
  });

  // 7.13 medicine_orders --------------------------------------------------
  await knex.schema.createTable('medicine_orders', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.string('order_number', 40).notNullable().unique();
    t.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.bigInteger('pharmacy_id').unsigned().notNullable().references('id').inTable('pharmacies').onDelete('CASCADE');
    t.bigInteger('prescription_id').unsigned().nullable().references('id').inTable('prescriptions').onDelete('SET NULL');
    t.bigInteger('delivery_address_id').unsigned().nullable().references('id').inTable('user_addresses').onDelete('SET NULL');
    t.decimal('subtotal', 10, 2).notNullable().defaultTo(0);
    t.decimal('delivery_fee', 10, 2).notNullable().defaultTo(0);
    t.decimal('total_amount', 10, 2).notNullable().defaultTo(0);
    t.enu('payment_method', E.vals(E.PAYMENT_METHOD)).notNullable().defaultTo(E.PAYMENT_METHOD.COD);
    t.enu('payment_status', E.vals(E.PAYMENT_STATUS)).notNullable().defaultTo(E.PAYMENT_STATUS.PENDING);
    t.enu('order_status', E.vals(E.ORDER_STATUS)).notNullable().defaultTo(E.ORDER_STATUS.PLACED);
    t.text('rejection_reason').nullable();
    t.text('cancellation_reason').nullable();
    t.timestamp('delivered_at').nullable();
    t.timestamps(true, true);
    t.index(['user_id']);
    t.index(['pharmacy_id']);
    t.index(['order_status']);
  });

  // 7.14 medicine_order_items --------------------------------------------
  await knex.schema.createTable('medicine_order_items', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('order_id').unsigned().notNullable().references('id').inTable('medicine_orders').onDelete('CASCADE');
    t.bigInteger('pharmacy_medicine_id').unsigned().nullable().references('id').inTable('pharmacy_medicines').onDelete('SET NULL');
    t.string('medicine_name_snapshot', 200).notNullable();
    t.decimal('price_snapshot', 10, 2).notNullable();
    t.integer('quantity').notNullable().defaultTo(1);
    t.decimal('total_price', 10, 2).notNullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index(['order_id']);
  });

  // 7.15 order_status_history --------------------------------------------
  await knex.schema.createTable('order_status_history', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('order_id').unsigned().notNullable().references('id').inTable('medicine_orders').onDelete('CASCADE');
    t.string('status', 40).notNullable();
    t.bigInteger('changed_by_user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.text('note').nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index(['order_id']);
  });

  // 7.16 ambulance_providers ---------------------------------------------
  await knex.schema.createTable('ambulance_providers', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.string('name', 180).notNullable();
    t.string('contact_mobile', 20).notNullable();
    t.string('city', 120).notNullable();
    t.enu('status', E.vals(E.ACTIVE_STATUS)).notNullable().defaultTo(E.ACTIVE_STATUS.ACTIVE);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 7.17 ambulances -------------------------------------------------------
  await knex.schema.createTable('ambulances', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('provider_id').unsigned().nullable().references('id').inTable('ambulance_providers').onDelete('SET NULL');
    t.string('vehicle_number', 40).notNullable();
    t.enu('ambulance_type', [E.AMBULANCE_TYPE.BASIC, E.AMBULANCE_TYPE.OXYGEN, E.AMBULANCE_TYPE.ICU, E.AMBULANCE_TYPE.OTHER]).notNullable().defaultTo(E.AMBULANCE_TYPE.BASIC);
    t.bigInteger('driver_user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.enu('status', ['available', 'busy', 'inactive']).notNullable().defaultTo('available');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // 7.18 ambulance_requests ----------------------------------------------
  await knex.schema.createTable('ambulance_requests', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('patient_name', 120).notNullable();
    t.string('contact_mobile', 20).notNullable();
    t.text('pickup_address').notNullable();
    t.text('drop_address').notNullable();
    t.decimal('pickup_latitude', 10, 7).nullable();
    t.decimal('pickup_longitude', 10, 7).nullable();
    t.decimal('drop_latitude', 10, 7).nullable();
    t.decimal('drop_longitude', 10, 7).nullable();
    t.enu('ambulance_type', E.vals(E.AMBULANCE_TYPE)).notNullable().defaultTo(E.AMBULANCE_TYPE.ANY);
    t.bigInteger('assigned_ambulance_id').unsigned().nullable().references('id').inTable('ambulances').onDelete('SET NULL');
    t.bigInteger('assigned_driver_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.enu('status', E.vals(E.AMBULANCE_STATUS)).notNullable().defaultTo(E.AMBULANCE_STATUS.REQUESTED);
    t.text('notes').nullable();
    t.timestamps(true, true);
    t.index(['user_id']);
    t.index(['status']);
  });

  // 7.19 notifications ----------------------------------------------------
  await knex.schema.createTable('notifications', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('title', 180).notNullable();
    t.text('message').notNullable();
    t.enu('type', E.vals(E.NOTIFICATION_TYPE)).notNullable().defaultTo(E.NOTIFICATION_TYPE.ADMIN);
    t.bigInteger('reference_id').unsigned().nullable();
    t.boolean('is_read').notNullable().defaultTo(false);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index(['user_id', 'is_read']);
  });

  // 7.20 support_tickets --------------------------------------------------
  await knex.schema.createTable('support_tickets', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.enu('related_type', E.vals(E.SUPPORT_RELATED)).notNullable().defaultTo(E.SUPPORT_RELATED.GENERAL);
    t.bigInteger('related_id').unsigned().nullable();
    t.string('subject', 200).notNullable();
    t.text('message').notNullable();
    t.enu('status', E.vals(E.SUPPORT_STATUS)).notNullable().defaultTo(E.SUPPORT_STATUS.OPEN);
    t.timestamps(true, true);
    t.index(['user_id']);
    t.index(['status']);
  });

  // 7.21 audit_logs -------------------------------------------------------
  await knex.schema.createTable('audit_logs', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('admin_user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.string('action', 120).notNullable();
    t.string('entity_type', 80).nullable();
    t.bigInteger('entity_id').unsigned().nullable();
    t.json('old_value').nullable();
    t.json('new_value').nullable();
    t.string('ip_address', 60).nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index(['admin_user_id']);
    t.index(['entity_type', 'entity_id']);
  });

  // --- Auth helper tables (not in blueprint schema but required) ---------
  await knex.schema.createTable('otp_codes', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.string('mobile', 20).notNullable();
    t.string('code_hash', 255).notNullable();
    t.enu('purpose', ['login', 'mobile_verify']).notNullable().defaultTo('login');
    t.integer('attempts').notNullable().defaultTo(0);
    t.boolean('consumed').notNullable().defaultTo(false);
    t.timestamp('expires_at').notNullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index(['mobile', 'purpose']);
  });

  await knex.schema.createTable('aadhaar_verifications', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('aadhaar_last4', 4).notNullable();
    t.string('provider', 40).notNullable().defaultTo('mock');
    t.string('client_ref', 120).nullable(); // provider client_id / reference for OTP step
    t.enu('status', ['otp_sent', 'verified', 'failed']).notNullable().defaultTo('otp_sent');
    t.timestamp('expires_at').nullable();
    t.timestamps(true, true);
    t.index(['user_id']);
  });
};

exports.down = async function down(knex) {
  const tables = [
    'aadhaar_verifications',
    'otp_codes',
    'audit_logs',
    'support_tickets',
    'notifications',
    'ambulance_requests',
    'ambulances',
    'ambulance_providers',
    'order_status_history',
    'medicine_order_items',
    'medicine_orders',
    'prescriptions',
    'pharmacy_medicines',
    'medicines',
    'medicine_categories',
    'pharmacy_documents',
    'pharmacies',
    'blood_request_matches',
    'blood_requests',
    'donor_profiles',
    'user_addresses',
    'user_profiles',
    'users',
  ];
  for (const tbl of tables) {
    // eslint-disable-next-line no-await-in-loop
    await knex.schema.dropTableIfExists(tbl);
  }
};
