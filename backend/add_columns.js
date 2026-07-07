const { sequelize } = require('./src/models');
const { QueryTypes } = require('sequelize');

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB');

    // Add created_by column
    try {
      await sequelize.query(
        "ALTER TABLE crm_activities ADD COLUMN created_by CHAR(36) NULL REFERENCES users(id);"
      );
      console.log('Added created_by column');
    } catch (e) {
      console.log('created_by column might already exist:', e.message);
    }

    // Add visibility column
    try {
      await sequelize.query(
        "ALTER TABLE crm_activities ADD COLUMN visibility ENUM('public', 'private') NOT NULL DEFAULT 'public';"
      );
      console.log('Added visibility column');
    } catch (e) {
      console.log('visibility column might already exist:', e.message);
    }

    console.log('Done');
    process.exit(0);
  } catch (error) {
    console.error('Failed', error);
    process.exit(1);
  }
}

run();
