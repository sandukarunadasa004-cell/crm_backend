'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CrmLead = sequelize.define('CrmLead', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    tenant_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'businesses', key: 'id' },
    },
    customer_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'crm_customers', key: 'id' },
      comment: 'Linked customer if converted or pre-existing',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    company_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    source: {
      type: DataTypes.ENUM('website', 'referral', 'social_media', 'cold_call', 'advertisement', 'walk_in', 'email', 'partner', 'event', 'other'),
      allowNull: false,
      defaultValue: 'other',
    },
    status: {
      type: DataTypes.ENUM('new', 'contacted', 'qualified', 'disqualified', 'converted'),
      allowNull: false,
      defaultValue: 'new',
    },
    temperature: {
      type: DataTypes.ENUM('hot', 'warm', 'cold'),
      allowNull: false,
      defaultValue: 'cold',
    },
    flag_status: {
      type: DataTypes.ENUM('none', 'flagged', 'completed'),
      allowNull: false,
      defaultValue: 'none',
    },
    interest: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Area of interest or product category',
    },
    estimated_value_lkr: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0.00,
    },
    owner_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      comment: 'Assigned sales user',
    },
    next_follow_up_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lost_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    custom_fields: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
      comment: 'JSON object storing custom field values',
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
  }, {
    tableName: 'crm_leads',
    indexes: [
      { fields: ['tenant_id'], name: 'idx_crm_leads_tenant' },
      { fields: ['tenant_id', 'status'], name: 'idx_crm_leads_status' },
      { fields: ['tenant_id', 'owner_id'], name: 'idx_crm_leads_owner' },
      { fields: ['tenant_id', 'next_follow_up_at'], name: 'idx_crm_leads_followup' },
    ],
  });

  return CrmLead;
};
