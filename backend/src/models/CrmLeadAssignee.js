'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CrmLeadAssignee = sequelize.define('CrmLeadAssignee', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    lead_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'crm_leads', key: 'id' },
      onDelete: 'CASCADE',
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    tenant_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  }, {
    tableName: 'crm_lead_assignees',
    indexes: [
      { fields: ['lead_id'], name: 'idx_lead_assignees_lead' },
      { fields: ['user_id'], name: 'idx_lead_assignees_user' },
      { unique: true, fields: ['lead_id', 'user_id'], name: 'uq_lead_assignee' },
    ],
  });

  return CrmLeadAssignee;
};
