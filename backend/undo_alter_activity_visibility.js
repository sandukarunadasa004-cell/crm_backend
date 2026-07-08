const { sequelize } = require('./src/models');

async function removeVisibilityColumn() {
  try {
    console.log('Removing visibility column from crm_activities table...');
    await sequelize.query('ALTER TABLE crm_activities DROP COLUMN visibility;');
    console.log('Visibility column removed successfully.');
    process.exit(0);
  } catch (error) {
    if (error.message.includes('check that column/key exists')) {
      console.log('Column "visibility" does not exist.');
    } else {
      console.error('Error removing column:', error);
    }
    process.exit(1);
  }
}

removeVisibilityColumn();
