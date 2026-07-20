'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CrmCustomField = sequelize.define('CrmCustomField', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    tenant_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    entity_type: {
      type: DataTypes.ENUM('customer', 'lead', 'deal', 'ticket', 'quote', 'todo'),
      allowNull: false,
    },
    field_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Internal key (e.g., linkedin_url)',
    },
    field_label: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Display name (e.g., LinkedIn URL)',
    },
    field_type: {
      type: DataTypes.ENUM('text', 'number', 'date', 'select', 'checkbox'),
      allowNull: false,
      defaultValue: 'text',
    },
    options: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of strings for select type',
    },
    is_required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    tableName: 'crm_custom_fields',
    indexes: [
      { fields: ['tenant_id', 'entity_type'], name: 'idx_crm_custom_fields_entity' },
      
      { fields: ['tenant_id', 'entity_type', 'field_name'], unique: true, name: 'idx_crm_custom_fields_unique' }
    ],
  });

  return CrmCustomField;
};
