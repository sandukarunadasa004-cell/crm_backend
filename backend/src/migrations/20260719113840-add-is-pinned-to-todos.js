'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('crm_todos');
    if (!tableDesc.is_pinned) {
      await queryInterface.addColumn('crm_todos', 'is_pinned', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      });
    }
  },

  async down(queryInterface) {
    const tableDesc = await queryInterface.describeTable('crm_todos');
    if (tableDesc.is_pinned) {
      await queryInterface.removeColumn('crm_todos', 'is_pinned');
    }
  },
};
