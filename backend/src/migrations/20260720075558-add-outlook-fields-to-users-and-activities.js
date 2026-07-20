'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'outlook_access_token', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'outlook_refresh_token', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'outlook_token_expiry', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('crm_activities', 'outlook_event_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'outlook_access_token');
    await queryInterface.removeColumn('users', 'outlook_refresh_token');
    await queryInterface.removeColumn('users', 'outlook_token_expiry');
    await queryInterface.removeColumn('crm_activities', 'outlook_event_id');
  }
};
