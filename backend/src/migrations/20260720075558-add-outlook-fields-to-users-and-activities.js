'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    
    const usersDesc = await queryInterface.describeTable('users');
    if (!usersDesc.outlook_access_token) {
      await queryInterface.addColumn('users', 'outlook_access_token', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!usersDesc.outlook_refresh_token) {
      await queryInterface.addColumn('users', 'outlook_refresh_token', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!usersDesc.outlook_token_expiry) {
      await queryInterface.addColumn('users', 'outlook_token_expiry', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    
    const activitiesDesc = await queryInterface.describeTable('crm_activities');
    if (!activitiesDesc.outlook_event_id) {
      await queryInterface.addColumn('crm_activities', 'outlook_event_id', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    const usersDesc = await queryInterface.describeTable('users');
    if (usersDesc.outlook_access_token) {
      await queryInterface.removeColumn('users', 'outlook_access_token');
    }
    if (usersDesc.outlook_refresh_token) {
      await queryInterface.removeColumn('users', 'outlook_refresh_token');
    }
    if (usersDesc.outlook_token_expiry) {
      await queryInterface.removeColumn('users', 'outlook_token_expiry');
    }

    const activitiesDesc = await queryInterface.describeTable('crm_activities');
    if (activitiesDesc.outlook_event_id) {
      await queryInterface.removeColumn('crm_activities', 'outlook_event_id');
    }
  }
};
