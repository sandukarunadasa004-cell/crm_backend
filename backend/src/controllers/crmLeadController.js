'use strict';

const crmLeadService = require('../services/crmLeadService');
const notificationService = require('../services/notificationService');
const { User } = require('../models');
const { Op } = require('sequelize');
const { sendSuccess, sendError, sendPaginated, getPagination, getPaginationMeta } = require('../utils/response');
const { logAudit, getAuditContext } = require('../utils/auditLogger');

const crmLeadController = {
  async getAllLeads(req, res) {
    try {
      const { page, limit, offset } = getPagination(req.query);
      const { search, status, source, owner_id } = req.query;

      const { count, rows } = await crmLeadService.getAllLeads({
        tenantId: req.tenantId,
        limit,
        offset,
        search,
        status,
        source,
        owner_id,
        userRole: req.user.role,
        userId: req.user.id
      });

      const paginationMeta = getPaginationMeta(count, page, limit);
      return sendPaginated(res, rows, paginationMeta, 'Leads retrieved successfully.');
    } catch (error) {
      console.error('Error fetching leads:', error);
      return sendError(res, error.message || 'Failed to fetch leads.', 500);
    }
  },

  async getLeadById(req, res) {
    try {
      const lead = await crmLeadService.getLeadById(req.params.id, req.tenantId);
      return sendSuccess(res, lead, 'Lead retrieved successfully.');
    } catch (error) {
      console.error('Error fetching lead:', error);
      const statusCode = error.message.includes('not found') ? 404 : 500;
      return sendError(res, error.message || 'Failed to fetch lead.', statusCode);
    }
  },

  async createLead(req, res) {
    try {
      const newLead = await crmLeadService.createLead({
        tenantId: req.tenantId,
        data: req.body,
        userId: req.user.id
      });

      await logAudit({
        ...getAuditContext(req),
        action: 'create',
        entityType: 'lead',
        entityId: newLead.id,
        after: newLead.toJSON(),
        description: `Lead ${newLead.name} created.`
      });

      
      const notifyUsers = await User.findAll({
        where: {
          business_id: req.tenantId,
          role: { [Op.in]: ['admin', 'manager'] },
          status: 'active',
          id: { [Op.ne]: req.user.id }
        },
        attributes: ['id']
      });

      for (const u of notifyUsers) {
        await notificationService.createNotification({
          tenant_id: req.tenantId,
          user_id: u.id,
          title: 'New Lead Created',
          body: `${req.user.firstName || 'A user'} created a new lead: ${newLead.name}`,
          link: `/crm/leads/${newLead.id}`,
          type: 'info'
        });
      }

      return sendSuccess(res, newLead, 'Lead created successfully.', 201);
    } catch (error) {
      console.error('Error creating lead:', error);
      const statusCode = error.message.includes('required') ? 400 : 500;
      return sendError(res, error.message || 'Failed to create lead.', statusCode);
    }
  },

  async updateLead(req, res) {
    try {
      const { lead, beforeData } = await crmLeadService.updateLead(req.params.id, req.tenantId, req.body);

      await logAudit({
        ...getAuditContext(req),
        action: 'update',
        entityType: 'lead',
        entityId: lead.id,
        before: beforeData,
        after: lead.toJSON(),
        description: `Lead ${lead.name} updated.`
      });

      return sendSuccess(res, lead, 'Lead updated successfully.');
    } catch (error) {
      console.error('Error updating lead:', error);
      const statusCode = error.message.includes('not found') ? 404 : 500;
      return sendError(res, error.message || 'Failed to update lead.', statusCode);
    }
  },

  async convertLead(req, res) {
    try {
      const { stage_id, deal_value, expected_close_at, products_interest } = req.body;
      const { lead, deal } = await crmLeadService.convertLead({
        leadId: req.params.id,
        tenantId: req.tenantId,
        stage_id,
        deal_value,
        expected_close_at,
        products_interest,
        userId: req.user.id
      });

      await logAudit({
        ...getAuditContext(req),
        action: 'convert',
        entityType: 'lead',
        entityId: lead.id,
        description: `Lead ${lead.name} converted to Deal #${deal.id}.`
      });

      return sendSuccess(res, { lead, deal }, 'Lead converted successfully.');
    } catch (error) {
      console.error('Error converting lead:', error);
      const statusCode = error.message.includes('not found') ? 404 : 400;
      return sendError(res, error.message || 'Failed to convert lead.', statusCode);
    }
  },

  async deleteLead(req, res) {
    try {
      const lead = await crmLeadService.deleteLead(req.params.id, req.tenantId);

      await logAudit({
        ...getAuditContext(req),
        action: 'archive',
        entityType: 'lead',
        entityId: lead.id,
        description: `Lead ${lead.name} archived.`
      });

      return sendSuccess(res, null, 'Lead archived successfully.');
    } catch (error) {
      console.error('Error deleting lead:', error);
      const statusCode = error.message.includes('not found') ? 404 : 500;
      return sendError(res, error.message || 'Failed to archive lead.', statusCode);
    }
  },

  async bulkDeleteLeads(req, res) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return sendError(res, 'Please provide an array of lead IDs.', 400);
      }

      const deletedCount = await crmLeadService.bulkDelete(ids, req.tenantId);

      await logAudit({
        ...getAuditContext(req),
        action: 'bulk_delete',
        entityType: 'lead',
        description: `Bulk deleted ${deletedCount} leads.`
      });

      return sendSuccess(res, { deletedCount }, `${deletedCount} leads deleted successfully.`);
    } catch (error) {
      console.error('Error bulk deleting leads:', error);
      return sendError(res, error.message || 'Failed to bulk delete leads.', 500);
    }
  },

  async bulkReassignLeads(req, res) {
    try {
      const { ids, owner_id } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return sendError(res, 'Please provide an array of lead IDs.', 400);
      }

      const updatedCount = await crmLeadService.bulkReassign(ids, owner_id, req.tenantId);

      await logAudit({
        ...getAuditContext(req),
        action: 'bulk_reassign',
        entityType: 'lead',
        description: `Bulk reassigned ${updatedCount} leads to owner ${owner_id}.`
      });

      return sendSuccess(res, { updatedCount }, `${updatedCount} leads reassigned successfully.`);
    } catch (error) {
      console.error('Error bulk reassigning leads:', error);
      return sendError(res, error.message || 'Failed to bulk reassign leads.', 500);
    }
  },

  async exportLeads(req, res) {
    try {
      const { count, rows } = await crmLeadService.getAllLeads({
        tenantId: req.tenantId,
        limit: 10000,
        offset: 0
      });

      const headers = ['Name', 'Email', 'Phone', 'Company', 'Source', 'Interest', 'Value', 'Status', 'Temperature', 'Notes'];
      const csvRows = [headers.join(',')];

      rows.forEach(lead => {
        const row = [
          `"${(lead.name || '').replace(/"/g, '""')}"`,
          `"${(lead.email || '').replace(/"/g, '""')}"`,
          `"${(lead.phone || '').replace(/"/g, '""')}"`,
          `"${(lead.company_name || '').replace(/"/g, '""')}"`,
          `"${(lead.source || '').replace(/"/g, '""')}"`,
          `"${(lead.interest || '').replace(/"/g, '""')}"`,
          lead.estimated_value_lkr || 0,
          `"${(lead.status || '').replace(/"/g, '""')}"`,
          `"${(lead.temperature || '').replace(/"/g, '""')}"`,
          `"${(lead.notes || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=leads_export_${Date.now()}.csv`);
      return res.send(csvContent);
    } catch (error) {
      console.error('Error exporting leads:', error);
      return sendError(res, error.message || 'Failed to export leads.', 500);
    }
  },

  async importLeads(req, res) {
    try {
      if (!req.file) {
        return sendError(res, 'Please upload a CSV file.', 400);
      }

      const csv = require('csv-parser');
      const fs = require('fs');
      const results = [];

      await new Promise((resolve, reject) => {
        fs.createReadStream(req.file.path)
          .pipe(csv())
          .on('data', (row) => {
            const lead = {
              name: row['Name'] || row['name'],
              email: row['Email'] || row['email'] || null,
              phone: row['Phone'] || row['phone'] || null,
              company_name: row['Company'] || row['company'] || row['company_name'] || null,
              source: row['Source'] || row['source'] || 'other',
              interest: row['Interest'] || row['interest'] || null,
              estimated_value_lkr: parseFloat(row['Value'] || row['estimated_value_lkr'] || 0) || 0,
              status: row['Status'] || row['status'] || 'new',
              temperature: row['Temperature'] || row['temperature'] || 'cold',
              notes: row['Notes'] || row['notes'] || null
            };
            if (lead.name) results.push(lead);
          })
          .on('end', resolve)
          .on('error', reject);
      });

      
      fs.unlinkSync(req.file.path);

      if (results.length === 0) {
        return sendError(res, 'No valid leads found in the CSV file. Ensure each row has a "Name" column.', 400);
      }

      const createdLeads = await crmLeadService.bulkCreate(results, req.tenantId, req.user.id);

      await logAudit({
        ...getAuditContext(req),
        action: 'import',
        entityType: 'lead',
        description: `Imported ${createdLeads.length} leads from CSV.`
      });

      return sendSuccess(res, { importedCount: createdLeads.length }, `${createdLeads.length} leads imported successfully.`, 201);
    } catch (error) {
      console.error('Error importing leads:', error);
      return sendError(res, error.message || 'Failed to import leads.', 500);
    }
  }
};

module.exports = crmLeadController;
