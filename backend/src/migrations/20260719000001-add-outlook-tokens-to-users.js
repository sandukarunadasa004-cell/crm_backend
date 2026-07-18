'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'outlook_access_token', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('users', 'outlook_refresh_token', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('users', 'outlook_token_expiry', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'outlook_access_token');
    await queryInterface.removeColumn('users', 'outlook_refresh_token');
    await queryInterface.removeColumn('users', 'outlook_token_expiry');
  },
};
