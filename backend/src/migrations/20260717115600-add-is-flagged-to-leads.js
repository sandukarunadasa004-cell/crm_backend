'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable('crm_leads');
    if (!tableDesc.is_flagged) {
      await queryInterface.addColumn('crm_leads', 'is_flagged', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  down: async (queryInterface) => {
    const tableDesc = await queryInterface.describeTable('crm_leads');
    if (tableDesc.is_flagged) {
      await queryInterface.removeColumn('crm_leads', 'is_flagged');
    }
  }
};
