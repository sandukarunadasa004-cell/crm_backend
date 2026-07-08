'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CrmActivity = sequelize.define('CrmActivity', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: {
      type: DataTypes.UUID, allowNull: false },
    related_type: { type: DataTypes.ENUM('customer', 'lead', 'deal', 'quote', 'ticket', 'system'), allowNull: true },
    related_id: {
      type: DataTypes.UUID, allowNull: true },
    activity_type: { type: DataTypes.ENUM('call', 'email', 'meeting', 'task', 'note', 'follow_up', 'system'), allowNull: false },
    visibility: { type: DataTypes.ENUM('public', 'private'), defaultValue: 'public', allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    due_at: { type: DataTypes.DATE, allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    owner_id: {
      type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
  }, {
    tableName: 'crm_activities',
    indexes: [
      { fields: ['tenant_id', 'related_type', 'related_id'], name: 'idx_activities_related' },
      { fields: ['tenant_id', 'owner_id'], name: 'idx_activities_owner' },
      { fields: ['tenant_id', 'due_at'], name: 'idx_activities_due' },
    ],
  });
  return CrmActivity;
};
