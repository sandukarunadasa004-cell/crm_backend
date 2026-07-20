'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserTenant = sequelize.define('UserTenant', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    tenant_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'businesses', key: 'id' },
    },
    role: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'sales_user',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    tableName: 'user_tenants',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: false,
    indexes: [
      { fields: ['user_id', 'tenant_id'], unique: true, name: 'idx_user_tenants_unique' },
      { fields: ['user_id'], name: 'idx_user_tenants_user' },
      { fields: ['tenant_id'], name: 'idx_user_tenants_tenant' },
    ],
  });

  return UserTenant;
};
