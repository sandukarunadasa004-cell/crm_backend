'use strict';

const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: './src/config/.env' });

const DEFAULT_STAGES = [
  { name: 'Lead In', sort_order: 1, probability_default: 10, is_won_stage: false, is_lost_stage: false, color: '#3B82F6' }, // Blue
  { name: 'Contacted', sort_order: 2, probability_default: 20, is_won_stage: false, is_lost_stage: false, color: '#8B5CF6' }, // Purple
  { name: 'Meeting Scheduled', sort_order: 3, probability_default: 40, is_won_stage: false, is_lost_stage: false, color: '#F59E0B' }, // Amber
  { name: 'Proposal Sent', sort_order: 4, probability_default: 60, is_won_stage: false, is_lost_stage: false, color: '#F97316' }, // Orange
  { name: 'Negotiation', sort_order: 5, probability_default: 80, is_won_stage: false, is_lost_stage: false, color: '#EC4899' }, // Pink
  { name: 'Closed Won', sort_order: 6, probability_default: 100, is_won_stage: true, is_lost_stage: false, color: '#10B981' }, // Green
  { name: 'Closed Lost', sort_order: 7, probability_default: 0, is_won_stage: false, is_lost_stage: true, color: '#EF4444' }, // Red
];

async function run() {
  const { Tenant, CrmDealStage, sequelize } = require('./src/models');

  console.log('Connecting to database...');
  await sequelize.authenticate();
  
  // Find all tenants (businesses)
  const tenants = await Tenant.findAll();
  if (tenants.length === 0) {
    console.log('No businesses found. Please run create-tenant-superadmin.js first.');
    process.exit(0);
  }

  console.log(`Found ${tenants.length} business(es). Seeding default pipeline stages...`);

  for (const tenant of tenants) {
    // Check if this tenant already has stages
    const existingStagesCount = await CrmDealStage.count({ where: { tenant_id: tenant.id } });
    
    if (existingStagesCount > 0) {
      console.log(`- Tenant ${tenant.name} already has ${existingStagesCount} stages. Skipping.`);
      continue;
    }

    console.log(`- Seeding stages for Tenant: ${tenant.name}`);
    const stagesToInsert = DEFAULT_STAGES.map(stage => ({
      id: uuidv4(),
      tenant_id: tenant.id,
      ...stage
    }));

    await CrmDealStage.bulkCreate(stagesToInsert);
    console.log(`  > Inserted ${DEFAULT_STAGES.length} stages.`);
  }

  console.log('\nSeeding completed successfully!');
  process.exit(0);
}

run().catch(err => {
  console.error('Error seeding pipeline stages:', err);
  process.exit(1);
});
