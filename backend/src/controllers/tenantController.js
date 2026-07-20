'use strict';

const { v4: uuidv4 } = require('uuid');
const { Tenant, UserTenant, sequelize } = require('../models');
const { sendSuccess, sendError } = require('../utils/response');
const { logAudit } = require('../utils/auditLogger');

const tenantController = {
  async createTenant(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { name } = req.body;

      if (!name || !name.trim()) {
        return sendError(res, 'Company name is required.', 400);
      }

      const cleanName = name.trim();

      // Check if name is already taken
      const existing = await Tenant.findOne({ where: { name: cleanName }, transaction });
      if (existing) {
        return sendError(res, 'A company with this name already exists.', 400);
      }

      // Create new Tenant
      const tenant = await Tenant.create({
        id: uuidv4(),
        name: cleanName,
        is_active: true,
      }, { transaction });

      // Link current user as super_admin
      await UserTenant.create({
        user_id: req.user.id,
        tenant_id: tenant.id,
        role: 'super_admin',
        is_active: true,
      }, { transaction });

      await logAudit({
        tenantId: tenant.id,
        userId: req.user.id,
        action: 'create',
        entityType: 'tenant',
        entityId: tenant.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        description: `Created new company: ${cleanName}`,
      });

      await transaction.commit();

      return sendSuccess(res, tenant, 'Company created successfully.', 201);
    } catch (error) {
      await transaction.rollback();
      console.error('Error creating company:', error);
      return sendError(res, 'Failed to create company.', 500);
    }
  }
};

module.exports = tenantController;
