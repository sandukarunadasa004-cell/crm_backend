/**
 * Seed script: Creates or resets BOTH super admins.
 * Run with: node create-tenant-superadmin.js
 *
 * Each super admin gets their own isolated business.
 * If the user already exists → password is RESET.
 * If the user does not exist → user is CREATED.
 */
'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: './.env' });

// ─── SUPER ADMINS TO SEED ────────────────────────────────────────────────────
const ADMINS = [
  {
    businessName: 'billify-business-1',
    email:        'superadmin@billify.lk',
    password:     'Admin@123',
  },
  {
    businessName: 'billify-business-2',
    email:        'superadmin2@billify.lk',
    password:     'Admin@123',
  },
];
// ────────────────────────────────────────────────────────────────────────────

async function seedAdmin({ businessName, email, password }) {
  const { User, Tenant, UserTenant } = require('./src/models');

  console.log(`\n── Processing: ${email} ──────────────────────`);

  // 1. Find or create the business
  let tenant = await Tenant.findOne({ where: { name: businessName } });
  if (!tenant) {
    tenant = await Tenant.create({ id: uuidv4(), name: businessName, is_active: true });
    console.log(`  [CREATED] Business: "${businessName}"`);
  } else {
    console.log(`  [FOUND]   Business: "${businessName}"`);
  }

  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);

  // 2. Find or create the user
  let user = await User.findOne({ where: { email } });
  if (user) {
    user.password    = hashedPassword;
    user.business_id = tenant.id;
    user.role        = 'super_admin';
    user.is_active   = true;
    await user.save();
    console.log(`  [UPDATED] Password reset for: ${email}`);
  } else {
    const emailPrefix = email.split('@')[0];
    user = await User.create({
      id:          uuidv4(),
      business_id: tenant.id,
      email,
      first_name:  emailPrefix,
      last_name:   '',
      password:    hashedPassword,
      role:        'super_admin',
      is_active:   true,
      status:      'active',
    });
    console.log(`  [CREATED] Super Admin: ${email}`);
  }

  // 3. Ensure user is linked to their tenant
  const existing = await UserTenant.findOne({ where: { user_id: user.id, tenant_id: tenant.id } });
  if (!existing) {
    await UserTenant.create({
      user_id:   user.id,
      tenant_id: tenant.id,
      role:      'super_admin',
      is_active: true,
    });
    console.log(`  [LINKED]  User → Business in user_tenants`);
  } else {
    console.log(`  [OK]      User already linked to business`);
  }

  console.log(`  ✅ Login: ${email} / ${password}`);
}

async function run() {
  const { sequelize } = require('./src/models');
  console.log('Connecting to database...');
  await sequelize.authenticate();
  console.log('Connected!\n');

  for (const admin of ADMINS) {
    await seedAdmin(admin);
  }

  console.log('\n══════════════════════════════════════════════');
  console.log('✅ All super admins are ready!');
  console.log('══════════════════════════════════════════════');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
