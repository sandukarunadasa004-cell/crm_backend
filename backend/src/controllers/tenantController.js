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

      
      const existing = await Tenant.findOne({ where: { name: cleanName }, transaction });
      if (existing) {
        return sendError(res, 'A company with this name already exists.', 400);
      }

      
      const tenant = await Tenant.create({
        id: uuidv4(),
        name: cleanName,
        is_active: true,
      }, { transaction });

      
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
  },

  async deleteTenant(req, res) {
    try {
      const { id } = req.params;
      
      
      
      const tenant = await Tenant.findOne({ where: { id } });
      if (!tenant) {
        return sendError(res, 'Company not found.', 404);
      }
      
      
      await tenant.update({ is_active: false });

      await logAudit({
        tenantId: tenant.id,
        userId: req.user.id,
        action: 'delete',
        entityType: 'tenant',
        entityId: tenant.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        description: `Soft deleted company: ${tenant.name}`,
      });

      return sendSuccess(res, null, 'Company deleted successfully.');
    } catch (error) {
      console.error('Error deleting company:', error);
      return sendError(res, 'Failed to delete company.', 500);
    }
  }
};

module.exports = tenantController;
