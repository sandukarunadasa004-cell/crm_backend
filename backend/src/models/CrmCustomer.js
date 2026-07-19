'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CrmCustomer = sequelize.define('CrmCustomer', {
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
    customer_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Auto-generated or manual unique code per tenant',
    },
    type: {
      type: DataTypes.ENUM('individual', 'retail', 'wholesale', 'company', 'supplier', 'lead_only'),
      allowNull: false,
      defaultValue: 'individual',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    company_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    secondary_phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    website: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    source: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'How customer was acquired (referral, website, walk-in, etc.)',
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'archived'),
      allowNull: false,
      defaultValue: 'active',
    },
    flag_status: {
      type: DataTypes.ENUM('none', 'flagged', 'completed'),
      allowNull: false,
      defaultValue: 'none',
    },
    tags_json: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of tag strings',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    billify_customer_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Link to existing Billify POS customer record',
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
    updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
  }, {
    tableName: 'crm_customers',
    indexes: [
      { fields: ['tenant_id'], name: 'idx_crm_customers_tenant' },
      { fields: ['tenant_id', 'customer_code'], unique: true, name: 'idx_crm_customers_code' },
      { fields: ['tenant_id', 'email'], name: 'idx_crm_customers_email' },
      { fields: ['tenant_id', 'phone'], name: 'idx_crm_customers_phone' },
      { fields: ['tenant_id', 'status'], name: 'idx_crm_customers_status' },
      { fields: ['tenant_id', 'type'], name: 'idx_crm_customers_type' },
    ],
  });

  return CrmCustomer;
};
