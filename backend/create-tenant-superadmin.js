/**
 * One-time script: Create a Super Admin for your tenant.
 * Run with: node create-tenant-superadmin.js
 */
'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: './src/config/.env' });

// ─── CONFIG — edit these ────────────────────────────────────────────────────
const BUSINESS_NAME = 'test-business-2'; // Use slug format since frontend converts it!
const SUPER_ADMIN_EMAIL = 'superadmin2@billify.lk';
const SUPER_ADMIN_PASSWORD = 'Admin@123';
const FIRST_NAME = 'Admin';
const LAST_NAME = 'Billify';
// ────────────────────────────────────────────────────────────────────────────

async function run() {
  const { User, Tenant, sequelize } = require('./src/models');

  console.log('Synchronizing database tables...');
  await sequelize.sync({ alter: true });
  console.log('Tables synchronized!');

  // 1. Find or create the business
  let tenant = await Tenant.findOne({ where: { name: BUSINESS_NAME } });
  if (!tenant) {
    tenant = await Tenant.create({
      id: uuidv4(),
      name: BUSINESS_NAME,
      is_active: true
    });
    console.log(`Created new business: ${BUSINESS_NAME} with ID: ${tenant.id}`);
  } else {
    console.log(`Found existing business: ${BUSINESS_NAME} with ID: ${tenant.id}`);
  }

  const TENANT_ID = tenant.id;

  // 2. Check if admin already exists
  const existing = await User.findOne({
    where: { business_id: TENANT_ID, role: 'super_admin' }
  });
  if (existing) {
    console.log('A Super Admin already exists for this tenant:', existing.email);
    process.exit(0);
  }

  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, salt);

  const user = await User.create({
    id: uuidv4(),
    business_id: TENANT_ID,
    email: SUPER_ADMIN_EMAIL,
    first_name: FIRST_NAME,
    last_name: LAST_NAME,
    password: hashedPassword,
    role: 'super_admin',
    is_active: true,
    status: 'active',
  });

  // 3. Add to the new UserTenant junction table for multi-company support
  const { UserTenant } = require('./src/models');
  await UserTenant.create({
    user_id: user.id,
    tenant_id: TENANT_ID,
    role: 'super_admin',
    is_active: true
  });

  console.log(' Super Admin created successfully!');
  console.log('   Email   :', user.email);
  console.log('   Password:', SUPER_ADMIN_PASSWORD);
  console.log('   Tenant  :', TENANT_ID);
  console.log('\nPlease log in with these credentials and change the password immediately.');
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
