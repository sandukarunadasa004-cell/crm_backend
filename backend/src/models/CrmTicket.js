'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CrmTicket = sequelize.define('CrmTicket', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: {
      type: DataTypes.UUID, allowNull: false, references: { model: 'businesses', key: 'id' } },
    ticket_no: { type: DataTypes.STRING(50), allowNull: false },
    customer_id: {
      type: DataTypes.UUID, allowNull: false, references: { model: 'crm_customers', key: 'id' } },
    subject: { type: DataTypes.STRING(500), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    category: { type: DataTypes.STRING(100), allowNull: true },
    priority: { type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'), allowNull: false, defaultValue: 'medium' },
    source: { type: DataTypes.ENUM('phone', 'email', 'chat', 'portal', 'social', 'other'), allowNull: false, defaultValue: 'portal' },
    status: { type: DataTypes.ENUM('open', 'in_progress', 'waiting_customer', 'resolved', 'closed'), allowNull: false, defaultValue: 'open' },
    flag_status: { type: DataTypes.ENUM('none', 'flagged', 'completed'), allowNull: false, defaultValue: 'none' },
    assignee_id: {
      type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
    due_at: { type: DataTypes.DATE, allowNull: true },
    is_overdue: { type: DataTypes.BOOLEAN, defaultValue: false },
    sla_alert_sent: { type: DataTypes.BOOLEAN, defaultValue: false },
    resolved_at: { type: DataTypes.DATE, allowNull: true },
    closed_at: { type: DataTypes.DATE, allowNull: true },
    created_by: {
      type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
  }, {
    tableName: 'crm_tickets',
    indexes: [
      { fields: ['tenant_id'], name: 'idx_crm_tickets_tenant' },
      { fields: ['tenant_id', 'ticket_no'], unique: true, name: 'idx_crm_tickets_no' },
      { fields: ['tenant_id', 'status'], name: 'idx_crm_tickets_status' },
      { fields: ['tenant_id', 'assignee_id'], name: 'idx_crm_tickets_assignee' },
      { fields: ['tenant_id', 'priority'], name: 'idx_crm_tickets_priority' },
    ],
  });
  return CrmTicket;
};
