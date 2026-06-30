const bcrypt = require('bcryptjs');
const E = require('../../constants/enums');

/**
 * Seed core reference data: an admin account, medicine categories,
 * a few master medicines, an ambulance provider, and a demo approved pharmacy.
 * Safe to re-run: clears the seeded tables first.
 */
exports.seed = async function seed(knex) {
  // Wipe in FK-safe order (only the tables we seed).
  await knex('pharmacy_medicines').del();
  await knex('medicines').del();
  await knex('medicine_categories').del();
  await knex('ambulances').del();
  await knex('ambulance_providers').del();
  await knex('pharmacies').del();
  await knex('users').whereIn('role', [E.ROLES.ADMIN, E.ROLES.PHARMACY_OWNER, E.ROLES.AMBULANCE_DRIVER]).del();

  // --- Admin user (web panel login uses mobile + password) ---------------
  const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
  const [adminId] = await knex('users').insert({
    name: 'NearDear Admin',
    mobile: '9999900001',
    email: 'admin@neardear.app',
    password_hash: adminPasswordHash,
    role: E.ROLES.ADMIN,
    status: E.USER_STATUS.ACTIVE,
    is_mobile_verified: true,
  });

  // --- Demo pharmacy owner + approved pharmacy ---------------------------
  const pharmaPasswordHash = await bcrypt.hash('Pharma@123', 10);
  const [pharmaOwnerId] = await knex('users').insert({
    name: 'Demo Pharmacy Owner',
    mobile: '9999900002',
    email: 'pharmacy@neardear.app',
    password_hash: pharmaPasswordHash,
    role: E.ROLES.PHARMACY_OWNER,
    status: E.USER_STATUS.ACTIVE,
    is_mobile_verified: true,
  });

  const [pharmacyId] = await knex('pharmacies').insert({
    owner_user_id: pharmaOwnerId,
    pharmacy_name: 'City Care Pharmacy',
    owner_name: 'Demo Pharmacy Owner',
    mobile: '9999900002',
    email: 'pharmacy@neardear.app',
    license_number: 'DL-DEMO-0001',
    gst_number: '22AAAAA0000A1Z5',
    address: '12 MG Road, Near City Hospital',
    city: 'Indore',
    state: 'Madhya Pradesh',
    pincode: '452001',
    approval_status: E.PHARMACY_APPROVAL.APPROVED,
    approved_by: adminId,
    approved_at: knex.fn.now(),
  });

  // --- Medicine categories ----------------------------------------------
  const categories = [
    { name: 'Fever & Pain Relief', slug: 'fever-pain-relief' },
    { name: 'Cough & Cold', slug: 'cough-cold' },
    { name: 'Diabetes Care', slug: 'diabetes-care' },
    { name: 'Antibiotics', slug: 'antibiotics' },
    { name: 'Vitamins & Supplements', slug: 'vitamins-supplements' },
    { name: 'Digestive Care', slug: 'digestive-care' },
    { name: 'First Aid', slug: 'first-aid' },
  ].map((c) => ({ ...c, status: E.ACTIVE_STATUS.ACTIVE }));

  await knex('medicine_categories').insert(categories);
  const catRows = await knex('medicine_categories').select('id', 'slug');
  const catBySlug = Object.fromEntries(catRows.map((r) => [r.slug, r.id]));

  // --- Master medicines --------------------------------------------------
  const medicines = [
    { name: 'Paracetamol', brand_name: 'Calpol', strength: '500mg', form: E.MEDICINE_FORM.TABLET, prescription_required: false, slug: 'fever-pain-relief', composition: 'Paracetamol 500mg' },
    { name: 'Ibuprofen', brand_name: 'Brufen', strength: '400mg', form: E.MEDICINE_FORM.TABLET, prescription_required: false, slug: 'fever-pain-relief', composition: 'Ibuprofen 400mg' },
    { name: 'Cough Syrup', brand_name: 'Benadryl', strength: '100ml', form: E.MEDICINE_FORM.SYRUP, prescription_required: false, slug: 'cough-cold', composition: 'Diphenhydramine' },
    { name: 'Cetirizine', brand_name: 'Cetzine', strength: '10mg', form: E.MEDICINE_FORM.TABLET, prescription_required: false, slug: 'cough-cold', composition: 'Cetirizine 10mg' },
    { name: 'Metformin', brand_name: 'Glycomet', strength: '500mg', form: E.MEDICINE_FORM.TABLET, prescription_required: true, slug: 'diabetes-care', composition: 'Metformin HCl 500mg' },
    { name: 'Amoxicillin', brand_name: 'Mox', strength: '500mg', form: E.MEDICINE_FORM.CAPSULE, prescription_required: true, slug: 'antibiotics', composition: 'Amoxicillin 500mg' },
    { name: 'Vitamin C', brand_name: 'Limcee', strength: '500mg', form: E.MEDICINE_FORM.TABLET, prescription_required: false, slug: 'vitamins-supplements', composition: 'Ascorbic Acid 500mg' },
    { name: 'ORS Powder', brand_name: 'Electral', strength: '21.8g', form: E.MEDICINE_FORM.OTHER, prescription_required: false, slug: 'digestive-care', composition: 'Oral Rehydration Salts' },
    { name: 'Antiseptic Liquid', brand_name: 'Dettol', strength: '100ml', form: E.MEDICINE_FORM.OTHER, prescription_required: false, slug: 'first-aid', composition: 'Chloroxylenol 4.8%' },
    { name: 'Pantoprazole', brand_name: 'Pan', strength: '40mg', form: E.MEDICINE_FORM.TABLET, prescription_required: true, slug: 'digestive-care', composition: 'Pantoprazole 40mg' },
  ];

  for (const m of medicines) {
    // eslint-disable-next-line no-await-in-loop
    const [medId] = await knex('medicines').insert({
      category_id: catBySlug[m.slug],
      name: m.name,
      brand_name: m.brand_name,
      composition: m.composition,
      strength: m.strength,
      form: m.form,
      prescription_required: m.prescription_required,
      status: E.ACTIVE_STATUS.ACTIVE,
    });

    // Demo pharmacy lists each medicine with a price.
    const price = 20 + Math.round((medId % 7) * 9.5);
    // eslint-disable-next-line no-await-in-loop
    await knex('pharmacy_medicines').insert({
      pharmacy_id: pharmacyId,
      medicine_id: medId,
      price,
      mrp: price + 10,
      stock_status: E.STOCK_STATUS.IN_STOCK,
      quantity_available: 100,
      prescription_required: m.prescription_required,
      status: E.ACTIVE_STATUS.ACTIVE,
    });
  }

  // --- Ambulance provider + driver + vehicle ----------------------------
  const [providerId] = await knex('ambulance_providers').insert({
    name: 'LifeLine Ambulance Services',
    contact_mobile: '9999900010',
    city: 'Indore',
    status: E.ACTIVE_STATUS.ACTIVE,
  });

  const driverPasswordHash = await bcrypt.hash('Driver@123', 10);
  const [driverId] = await knex('users').insert({
    name: 'Demo Driver',
    mobile: '9999900003',
    email: 'driver@neardear.app',
    password_hash: driverPasswordHash,
    role: E.ROLES.AMBULANCE_DRIVER,
    status: E.USER_STATUS.ACTIVE,
    is_mobile_verified: true,
  });

  await knex('ambulances').insert({
    provider_id: providerId,
    vehicle_number: 'MP09-AB-1234',
    ambulance_type: E.AMBULANCE_TYPE.BASIC,
    driver_user_id: driverId,
    status: 'available',
  });

  // eslint-disable-next-line no-console
  console.log('Seed complete. Admin login -> mobile: 9999900001  password: Admin@123');
};
