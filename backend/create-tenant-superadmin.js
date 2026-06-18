/**
 * One-time script: Create a Super Admin for your tenant.
 * Run with: node create-tenant-superadmin.js
 */
'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: './src/config/.env' });

// ─── CONFIG — edit these ────────────────────────────────────────────────────
const TENANT_ID = 'dddba407-1ea2-4727-9b28-e02d7ca42037'; // your shop's business_id
const SUPER_ADMIN_EMAIL    = 'superadmin@billify.lk';
const SUPER_ADMIN_PASSWORD = 'Admin@123';
const FIRST_NAME = 'Admin';
const LAST_NAME  = 'Billify';
// ────────────────────────────────────────────────────────────────────────────

async function run() {
  const { User, sequelize } = require('./src/models');

  console.log('Synchronizing database tables...');
  await sequelize.sync({ alter: true });
  console.log('Tables synchronized!');

  // Check if one already exists
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

  console.log(' Super Admin created successfully!');
  console.log('   Email   :', user.email);
  console.log('   Password:', SUPER_ADMIN_PASSWORD);
  console.log('   Tenant  :', TENANT_ID);
  console.log('\nPlease log in with these credentials and change the password immediately.');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
