/**
 * One-time script: Create/Update Super Admins for your tenant.
 * Run with: node create-tenant-superadmin.js
 */
'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: './.env' });

// ─── CONFIG — edit these ────────────────────────────────────────────────────
const BUSINESS_NAME = 'test-business-2'; // Use slug format since frontend converts it!
const PASSWORD = 'Admin@123';
const ADMINS = [
  { email: 'superadmin@billify.lk', firstName: 'Admin', lastName: 'Billify' },
  { email: 'superadmin2@billify.lk', firstName: 'Admin2', lastName: 'Billify' }
];
// ────────────────────────────────────────────────────────────────────────────

async function run() {
  const { User, Tenant, sequelize, UserTenant } = require('./src/models');

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
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(PASSWORD, salt);

  // 2. Loop through and create/update admins
  for (const adminData of ADMINS) {
    let user = await User.findOne({ where: { email: adminData.email } });
    
    if (user) {
      // Update password to ensure it matches
      user.password = hashedPassword;
      user.business_id = TENANT_ID;
      user.role = 'super_admin';
      user.is_active = true;
      await user.save();
      console.log(`[UPDATED] Existing admin password reset for: ${adminData.email}`);
    } else {
      // Create new user
      user = await User.create({
        id: uuidv4(),
        business_id: TENANT_ID,
        email: adminData.email,
        first_name: adminData.firstName,
        last_name: adminData.lastName,
        password: hashedPassword,
        role: 'super_admin',
        is_active: true,
        status: 'active',
      });
      console.log(`[CREATED] New admin created for: ${adminData.email}`);
    }

    // 3. Add to the new UserTenant junction table for multi-company support
    let ut = await UserTenant.findOne({ where: { user_id: user.id, tenant_id: TENANT_ID } });
    if (!ut) {
      await UserTenant.create({
        user_id: user.id,
        tenant_id: TENANT_ID,
        role: 'super_admin',
        is_active: true
      });
    }
  }

  console.log('\n✅ All Super Admins are ready!');
  console.log('Password for both is:', PASSWORD);
  console.log('\nPlease log in with these credentials and change the password immediately.');
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
