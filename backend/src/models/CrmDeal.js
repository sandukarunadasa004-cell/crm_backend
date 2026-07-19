'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CrmDeal = sequelize.define('CrmDeal', {
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
      allowNull: false,
      references: { model: 'crm_customers', key: 'id' },
    },
    lead_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'crm_leads', key: 'id' },
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    stage_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'crm_deal_stages', key: 'id' },
    },
    value_lkr: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    probability: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: 'Win probability percentage (0-100)',
    },
    expected_close_at: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    owner_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    status: {
      type: DataTypes.ENUM('open', 'won', 'lost'),
      allowNull: false,
      defaultValue: 'open',
    },
    flag_status: {
      type: DataTypes.ENUM('none', 'flagged', 'completed'),
      allowNull: false,
      defaultValue: 'none',
    },
    won_lost_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    products_interest: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of {product_id, product_name, qty, note} objects',
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
  }, {
    tableName: 'crm_deals',
    indexes: [
      { fields: ['tenant_id'], name: 'idx_crm_deals_tenant' },
      { fields: ['tenant_id', 'stage_id'], name: 'idx_crm_deals_stage' },
      { fields: ['tenant_id', 'status'], name: 'idx_crm_deals_status' },
      { fields: ['tenant_id', 'owner_id'], name: 'idx_crm_deals_owner' },
      { fields: ['tenant_id', 'customer_id'], name: 'idx_crm_deals_customer' },
    ],
  });

  return CrmDeal;
};
