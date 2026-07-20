'use strict';

const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    business_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'password_hash',
    },
    role: {
      type: DataTypes.STRING(255),
      defaultValue: 'cashier',
    },
    phone: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    first_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    last_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    status: {
      type: DataTypes.STRING(255),
      defaultValue: 'active',
    },
    outlook_access_token: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    outlook_refresh_token: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    outlook_token_expiry: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    outlook_connected: {
      type: DataTypes.VIRTUAL,
      get() {
        return !!this.getDataValue('outlook_refresh_token');
      }
    },

    name: {
      type: DataTypes.VIRTUAL,
      get() {
        const first = this.getDataValue('first_name') || '';
        const last = this.getDataValue('last_name') || '';
        return `${first} ${last}`.trim() || this.getDataValue('email') || '';
      },
    },
  }, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: false,
  });

  User.prototype.validatePassword = async function(pwd) {
    if (!this.password) return false;
    return await bcrypt.compare(pwd, this.password);
  };

  User.prototype.toSafeJSON = function() {
    const values = { ...this.get() };
    delete values.password;
    return values;
  };

  return User;
};
