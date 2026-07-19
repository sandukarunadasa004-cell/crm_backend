'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CrmTodo = sequelize.define('CrmTodo', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID, allowNull: false },
    user_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    is_public: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_pinned: { type: DataTypes.BOOLEAN, defaultValue: false },
    completed_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'crm_todos',
    indexes: [
      { fields: ['tenant_id', 'user_id'], name: 'idx_todos_user' },
      { fields: ['tenant_id', 'is_public'], name: 'idx_todos_public' },
    ],
  });
  return CrmTodo;
};
