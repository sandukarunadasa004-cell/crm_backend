'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable('crm_leads');

    
    if (tableDesc.is_flagged) {
      await queryInterface.removeColumn('crm_leads', 'is_flagged');
    }

    
    if (!tableDesc.flag_status) {
      await queryInterface.addColumn('crm_leads', 'flag_status', {
        type: Sequelize.ENUM('none', 'flagged', 'completed'),
        allowNull: false,
        defaultValue: 'none',
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable('crm_leads');

    if (tableDesc.flag_status) {
      await queryInterface.removeColumn('crm_leads', 'flag_status');
    }

    if (!tableDesc.is_flagged) {
      await queryInterface.addColumn('crm_leads', 'is_flagged', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  }
};
