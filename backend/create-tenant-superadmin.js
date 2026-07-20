/**
 * One-time script: Create or reset a Super Admin for a given business.
 * Run with: node create-tenant-superadmin.js
 * 
 * HOW IT WORKS:
 *  - If the email already exists → password is RESET to the one below.
 *  - If the email does not exist → user is CREATED.
 *  - If the business does not exist → business is CREATED.
 * 
 * One super admin = one business owner. Each owner manages their own:
 *   companies, staff, customers, leads, deals — all fully isolated.
 */
'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: './.env' });

// ─── EDIT THESE to create or reset a super admin ────────────────────────────
const BUSINESS_NAME   = 'test-business-2';        // Slug-style name
const EMAIL           = 'superadmin2@billify.lk';  // Login email
const PASSWORD        = 'Admin@123';               // Login password
// ────────────────────────────────────────────────────────────────────────────

async function run() {
  const { User, Tenant, UserTenant, sequelize } = require('./src/models');

  // 1. Find or create the business (tenant)
  let tenant = await Tenant.findOne({ where: { name: BUSINESS_NAME } });
  if (!tenant) {
    tenant = await Tenant.create({ id: uuidv4(), name: BUSINESS_NAME, is_active: true });
    console.log(`[CREATED] Business: "${BUSINESS_NAME}" (${tenant.id})`);
  } else {
    console.log(`[FOUND]   Business: "${BUSINESS_NAME}" (${tenant.id})`);
  }

  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(PASSWORD, salt);

  // 2. Find or create the user
  let user = await User.findOne({ where: { email: EMAIL } });

  if (user) {
    // Reset password and ensure they are a super_admin for this business
    user.password     = hashedPassword;
    user.business_id  = tenant.id;
    user.role         = 'super_admin';
    user.is_active    = true;
    await user.save();
    console.log(`[UPDATED] Password reset for: ${EMAIL}`);
  } else {
    // Create new user — name is derived from email prefix if not set
    const emailPrefix = EMAIL.split('@')[0];
    user = await User.create({
      id:          uuidv4(),
      business_id: tenant.id,
      email:       EMAIL,
      first_name:  emailPrefix,
      last_name:   '',
      password:    hashedPassword,
      role:        'super_admin',
      is_active:   true,
      status:      'active',
    });
    console.log(`[CREATED] Super Admin: ${EMAIL}`);
  }

  // 3. Link user to tenant in UserTenant table (multi-company support)
  const existing = await UserTenant.findOne({ where: { user_id: user.id, tenant_id: tenant.id } });
  if (!existing) {
    await UserTenant.create({
      user_id:   user.id,
      tenant_id: tenant.id,
      role:      'super_admin',
      is_active: true,
    });
    console.log(`[LINKED]  User → Business in user_tenants table`);
  }

  console.log('\n✅ Done!');
  console.log(`   Email   : ${EMAIL}`);
  console.log(`   Password: ${PASSWORD}`);
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
