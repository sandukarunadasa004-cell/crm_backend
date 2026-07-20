'use strict';

const { Op } = require('sequelize');
const { CrmLead, CrmCustomer, CrmDeal, User, CrmLeadAssignee } = require('../models');
const { isValidEmail, isValidPhone } = require('../utils/validators');

const crmLeadService = {
  async getAllLeads({ tenantId, limit, offset, search, status, source, owner_id, userRole, userId }) {
    const whereClause = { tenant_id: tenantId };

    
    if (status === 'active') {
      whereClause.status = { [Op.ne]: 'converted' };
    } else if (status) {
      whereClause.status = status;
    }

    if (source) whereClause.source = source;
    if (owner_id) whereClause.owner_id = owner_id;

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { company_name: { [Op.like]: `%${search}%` } },
      ];
    }

    const includeOptions = [
      { model: User, as: 'owner', attributes: ['id', 'first_name', 'last_name', 'email'] },
      { model: CrmCustomer, as: 'customer', attributes: ['id', 'name'] },
      { model: User, as: 'assignees', attributes: ['id', 'first_name', 'last_name', 'email'], through: { attributes: [] } }
    ];

    
    if (userRole && !['admin', 'manager'].includes(userRole) && userId) {
      
      const assignedLeadRows = await CrmLeadAssignee.findAll({
        where: { user_id: userId, tenant_id: tenantId },
        attributes: ['lead_id']
      });
      const assignedLeadIds = assignedLeadRows.map(r => r.lead_id);

      
      
      const accessCondition = {
        [Op.or]: [
          { owner_id: userId },
          { id: { [Op.in]: assignedLeadIds } }
        ]
      };

      if (whereClause[Op.or]) {
        whereClause[Op.and] = [
          { [Op.or]: whereClause[Op.or] },
          accessCondition
        ];
        delete whereClause[Op.or];
      } else {
        whereClause[Op.or] = accessCondition[Op.or];
      }
    }

    const { count, rows } = await CrmLead.findAndCountAll({
      where: whereClause,
      include: includeOptions,
      limit,
      offset,
      order: [['created_at', 'DESC']]
    });

    return { count, rows };
  },

  async getLeadById(leadId, tenantId) {
    const lead = await CrmLead.findOne({
      where: { id: leadId, tenant_id: tenantId },
      include: [
        { model: User, as: 'owner', attributes: ['id', 'first_name', 'last_name', 'email'] },
        { model: CrmCustomer, as: 'customer', attributes: ['id', 'name'] },
        { model: User, as: 'assignees', attributes: ['id', 'first_name', 'last_name', 'email'], through: { attributes: [] } }
      ]
    });

    if (!lead) throw new Error('Lead not found.');

    return lead;
  },

  async createLead({ tenantId, data, userId }) {
    const { name, email, phone, company_name, source, interest, estimated_value_lkr, owner_id, next_follow_up_at, notes, customer_id, custom_fields, temperature, assignee_ids } = data;

    if (!name) throw new Error('Lead name is required.');

    if (!isValidEmail(email)) throw new Error('Invalid email format.');
    if (!isValidPhone(phone)) throw new Error('Invalid phone format.');

    const newLead = await CrmLead.create({
      tenant_id: tenantId,
      name,
      email,
      phone,
      company_name,
      source: source || 'other',
      status: data.status || 'new',
      temperature: temperature || 'cold',
      interest,
      estimated_value_lkr: estimated_value_lkr || 0,
      owner_id: owner_id || userId,
      next_follow_up_at,
      notes,
      customer_id,
      custom_fields: custom_fields || {},
      created_by: userId
    });

    
    if (Array.isArray(assignee_ids) && assignee_ids.length > 0) {
      const assigneeRows = assignee_ids
        .filter(uid => uid && uid !== (owner_id || userId)) 
        .map(uid => ({ lead_id: newLead.id, user_id: uid, tenant_id: tenantId }));
      if (assigneeRows.length > 0) {
        await CrmLeadAssignee.bulkCreate(assigneeRows, { ignoreDuplicates: true });
      }
    }

    const leadWithAssociations = await CrmLead.findOne({
      where: { id: newLead.id, tenant_id: tenantId },
      include: [
        { model: User, as: 'owner', attributes: ['id', 'first_name', 'last_name', 'email'] },
        { model: CrmCustomer, as: 'customer', attributes: ['id', 'name'] },
        { model: User, as: 'assignees', attributes: ['id', 'first_name', 'last_name', 'email'], through: { attributes: [] } }
      ]
    });

    return leadWithAssociations;
  },

  async updateLead(leadId, tenantId, updateData) {
    const lead = await CrmLead.findOne({ where: { id: leadId, tenant_id: tenantId } });
    if (!lead) throw new Error('Lead not found.');

    
    const { assignee_ids, ...modelData } = updateData;

    delete modelData.id;
    delete modelData.tenant_id;

    if (modelData.email !== undefined && !isValidEmail(modelData.email)) throw new Error('Invalid email format.');
    if (modelData.phone !== undefined && !isValidPhone(modelData.phone)) throw new Error('Invalid phone format.');

    if (modelData.custom_fields !== undefined) {
      lead.custom_fields = modelData.custom_fields;
    }

    const beforeData = lead.toJSON();
    await lead.update(modelData);

    
    if (Array.isArray(assignee_ids)) {
      await CrmLeadAssignee.destroy({ where: { lead_id: leadId } });
      if (assignee_ids.length > 0) {
        const assigneeRows = assignee_ids.map(uid => ({ lead_id: leadId, user_id: uid, tenant_id: tenantId }));
        await CrmLeadAssignee.bulkCreate(assigneeRows, { ignoreDuplicates: true });
      }
    }

    return { lead, beforeData };
  },

  async convertLead({ leadId, tenantId, stage_id, deal_value, expected_close_at, products_interest, userId }) {
    const lead = await CrmLead.findOne({ where: { id: leadId, tenant_id: tenantId } });
    if (!lead) throw new Error('Lead not found.');

    if (lead.status === 'converted') {
      throw new Error('Lead is already converted.');
    }

    if (!stage_id) throw new Error('stage_id is required to create a deal.');

    let customerId = lead.customer_id;
    if (!customerId) {
      const count = await CrmCustomer.count({ where: { tenant_id: tenantId }, paranoid: false });
      const newCustomer = await CrmCustomer.create({
        tenant_id: tenantId,
        customer_code: `CUST-${String(count + 1).padStart(4, '0')}`,
        type: 'lead_only',
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company_name: lead.company_name,
        source: lead.source,
        created_by: userId
      });
      customerId = newCustomer.id;
      lead.customer_id = customerId;
    }

    const newDeal = await CrmDeal.create({
      tenant_id: tenantId,
      customer_id: customerId,
      lead_id: lead.id,
      title: `${lead.name} - Deal`,
      stage_id,
      value_lkr: deal_value || lead.estimated_value_lkr || 0,
      owner_id: lead.owner_id || userId,
      expected_close_at: expected_close_at || null,
      notes: lead.notes || null,
      
      products_interest: products_interest && products_interest.length > 0 
        ? products_interest 
        : (lead.interest ? [{ product_id: null, product_name: lead.interest, qty: 1, unit_price: Number(lead.estimated_value_lkr) || 0 }] : []),
      created_by: userId
    });

    await lead.update({ status: 'converted' });

    return { lead, deal: newDeal };
  },

  async deleteLead(leadId, tenantId) {
    const lead = await CrmLead.findOne({ where: { id: leadId, tenant_id: tenantId } });
    if (!lead) throw new Error('Lead not found.');

    await lead.destroy();
    return lead;
  },

  async bulkDelete(leadIds, tenantId) {
    if (!Array.isArray(leadIds) || leadIds.length === 0) return 0;
    const deletedCount = await CrmLead.destroy({
      where: {
        id: { [Op.in]: leadIds },
        tenant_id: tenantId
      }
    });
    return deletedCount;
  },

  async bulkReassign(leadIds, ownerId, tenantId) {
    if (!Array.isArray(leadIds) || leadIds.length === 0) return 0;
    const [updatedCount] = await CrmLead.update(
      { owner_id: ownerId || null },
      {
        where: {
          id: { [Op.in]: leadIds },
          tenant_id: tenantId,
          status: { [Op.ne]: 'converted' } 
        }
      }
    );
    return updatedCount;
  },

  async bulkCreate(leadsData, tenantId, userId) {
    if (!Array.isArray(leadsData) || leadsData.length === 0) return [];
    
    const leadsToInsert = leadsData.map(data => ({
      tenant_id: tenantId,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      company_name: data.company_name || null,
      source: data.source || 'other',
      status: data.status || 'new',
      temperature: data.temperature || 'cold',
      interest: data.interest || null,
      estimated_value_lkr: parseFloat(data.estimated_value_lkr) || 0,
      notes: data.notes || null,
      created_by: userId
    }));

    const createdLeads = await CrmLead.bulkCreate(leadsToInsert);
    return createdLeads;
  }
};

module.exports = crmLeadService;
