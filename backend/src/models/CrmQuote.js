'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CrmQuote = sequelize.define('CrmQuote', {
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
    quote_no: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    customer_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'crm_customers', key: 'id' },
    },
    lead_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'crm_leads', key: 'id' },
    },
    deal_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'crm_deals', key: 'id' },
    },
    status: {
      type: DataTypes.ENUM('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted'),
      allowNull: false,
      defaultValue: 'draft',
    },
    flag_status: {
      type: DataTypes.ENUM('none', 'flagged', 'completed'),
      allowNull: false,
      defaultValue: 'none',
    },
    subtotal_lkr: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    discount_lkr: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    tax_lkr: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    total_lkr: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    valid_until: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    terms: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Terms and conditions',
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    custom_fields: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
      comment: 'JSON object storing custom field values',
    },
  }, {
    tableName: 'crm_quotes',
    indexes: [
      { fields: ['tenant_id'], name: 'idx_crm_quotes_tenant' },
      { fields: ['tenant_id', 'quote_no'], unique: true, name: 'idx_crm_quotes_no' },
      { fields: ['tenant_id', 'customer_id'], name: 'idx_crm_quotes_customer' },
      { fields: ['tenant_id', 'status'], name: 'idx_crm_quotes_status' },
    ],
  });

  return CrmQuote;
};
