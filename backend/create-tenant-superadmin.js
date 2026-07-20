
'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: './.env' });


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
  {
    businessName: 'billify-business-3',
    email:        'superadmin3@billify.lk',
    password:     'Admin@123',
  },
];


async function seedAdmin({ businessName, email, password }) {
  const { User, Tenant, UserTenant, CrmDealStage } = require('./src/models');

  console.log(`\n── Processing: ${email} ──────────────────────`);

  
  let tenant = await Tenant.findOne({ where: { name: businessName } });
  if (!tenant) {
    tenant = await Tenant.create({ id: uuidv4(), name: businessName, is_active: true });
    console.log(`  [CREATED] Business: "${businessName}"`);
  } else {
    console.log(`  [FOUND]   Business: "${businessName}"`);
  }

  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);

  
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

  
  await UserTenant.destroy({ where: { user_id: user.id } });
  await UserTenant.create({
    user_id:   user.id,
    tenant_id: tenant.id,
    role:      'super_admin',
    is_active: true,
  });
  console.log(`  [LINKED]  User → "${businessName}" only (stale links removed)`);

  
  const existingStages = await CrmDealStage.count({ where: { tenant_id: tenant.id } });
  if (existingStages === 0) {
    const defaultStages = [
      { name: 'Lead In',        sort_order: 1, probability_default: 10,  is_won_stage: false, is_lost_stage: false, color: '#6366f1' },
      { name: 'Contact Made',   sort_order: 2, probability_default: 25,  is_won_stage: false, is_lost_stage: false, color: '#3b82f6' },
      { name: 'Proposal Sent',  sort_order: 3, probability_default: 50,  is_won_stage: false, is_lost_stage: false, color: '#f59e0b' },
      { name: 'Negotiation',    sort_order: 4, probability_default: 75,  is_won_stage: false, is_lost_stage: false, color: '#f97316' },
      { name: 'Won',            sort_order: 5, probability_default: 100, is_won_stage: true,  is_lost_stage: false, color: '#10b981' },
      { name: 'Lost',           sort_order: 6, probability_default: 0,   is_won_stage: false, is_lost_stage: true,  color: '#ef4444' },
    ];

    for (const s of defaultStages) {
      await CrmDealStage.create({ id: uuidv4(), tenant_id: tenant.id, ...s });
    }
    console.log(`  [SEEDED]  6 default pipeline stages created`);
  } else {
    console.log(`  [OK]      Pipeline stages already exist (${existingStages} stages)`);
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
