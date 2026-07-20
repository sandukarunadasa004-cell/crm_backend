'use strict';

const { Op } = require('sequelize');
const { CrmInteraction, CrmActivity, CrmCustomer, User, CrmDeal, CrmLead, CrmQuote } = require('../models');

const crmActivityService = {
  async getInteractions({ tenantId, limit, offset, channel }) {
    const whereClause = { tenant_id: tenantId };
    if (channel && channel !== 'all') {
      whereClause.channel = channel;
    }

    const { count, rows } = await CrmInteraction.findAndCountAll({
      where: whereClause,
      include: [
        { model: CrmCustomer, as: 'customer', attributes: ['id', 'name', 'company_name'] },
        { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] }
      ],
      order: [['interaction_at', 'DESC']],
      limit,
      offset
    });

    
    const formattedRows = rows.map(row => ({
      id: row.id,
      channel: row.channel,
      direction: row.direction,
      customer_name: row.customer ? (row.customer.company_name || row.customer.name) : 'Unknown',
      customer_id: row.customer_id,
      summary: row.summary,
      created_by: row.creator ? `${row.creator.first_name}` : 'System',
      interaction_at: row.interaction_at,
      related_type: row.related_type,
      related_id: row.related_id,
      attachment_url: row.attachment_url,
      attachment_name: row.attachment_name
    }));

    return { count, rows: formattedRows };
  },

  async createInteraction({ tenantId, data, userId }) {
    const { customer_id, channel, direction, summary, related_type, related_id, attachment_url, attachment_name } = data;

    if (!customer_id || !channel || !summary) {
      throw new Error('Customer, channel, and summary are required.');
    }

    const interaction = await CrmInteraction.create({
      tenant_id: tenantId,
      customer_id,
      channel,
      direction: direction || 'outbound',
      summary,
      related_type,
      related_id,
      attachment_url,
      attachment_name,
      created_by: userId,
      interaction_at: new Date()
    });

    
    const newInteraction = await CrmInteraction.findOne({
      where: { id: interaction.id },
      include: [
        { model: CrmCustomer, as: 'customer', attributes: ['id', 'name', 'company_name'] },
        { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] }
      ]
    });

    const formatted = {
      id: newInteraction.id,
      channel: newInteraction.channel,
      direction: newInteraction.direction,
      customer_name: newInteraction.customer ? (newInteraction.customer.company_name || newInteraction.customer.name) : 'Unknown',
      customer_id: newInteraction.customer_id,
      summary: newInteraction.summary,
      created_by: newInteraction.creator ? `${newInteraction.creator.first_name}` : 'System',
      interaction_at: newInteraction.interaction_at,
      related_type: newInteraction.related_type,
      related_id: newInteraction.related_id,
      attachment_url: newInteraction.attachment_url,
      attachment_name: newInteraction.attachment_name
    };

    return { interaction, formatted };
  },

  async deleteInteraction({ id, tenantId }) {
    const interaction = await CrmInteraction.findOne({ where: { id, tenant_id: tenantId } });
    if (!interaction) throw new Error('Interaction not found.');
    await interaction.destroy();
    return true;
  },

  

  async getCalendarActivities({ tenantId, start, end, userId }) {
    const where = { tenant_id: tenantId };

    if (start && end) {
      where.due_at = {
        [Op.between]: [new Date(start), new Date(end)]
      };
    } else if (start) {
      where.due_at = { [Op.gte]: new Date(start) };
    } else if (end) {
      where.due_at = { [Op.lte]: new Date(end) };
    }

    const activities = await CrmActivity.findAll({
      where,
      include: [
        { model: User, as: 'owner', attributes: ['id', 'first_name'] }
      ],
      order: [['due_at', 'ASC']]
    });

    return activities.map(act => ({
      ...act.toJSON(),
      owner_name: act.owner ? `${act.owner.first_name}` : 'Unassigned'
    }));
  },

  async createActivity({ tenantId, data, userId }) {
    const { activity_type, title, description, due_at, owner_id, related_type, related_id } = data;

    if (!activity_type || !title || !due_at) {
      throw new Error('Activity type, title, and due date are required.');
    }

    const activity = await CrmActivity.create({
      tenant_id: tenantId,
      activity_type,
      title,
      description,
      due_at,
      owner_id: owner_id || userId,
      related_type: related_type || null,
      related_id: related_id || null, 
    });

    try {
      const user = await User.findByPk(userId);
      if (user && user.outlook_connected) {
        const outlookCalendarService = require('./outlookCalendarService');
        await outlookCalendarService.pushEventToOutlook(user, activity);
      }
    } catch (err) {
      console.error('Failed to sync new activity to outlook:', err);
    }

    return activity;
  },

  async getActivitiesByEntity({ tenantId, related_type, related_id, overdue, userId }) {
    const where = { tenant_id: tenantId };
    if (related_type) where.related_type = related_type;
    if (related_id) where.related_id = related_id;
    if (overdue === 'true' || overdue === true) {
      where.due_at = { [Op.lt]: new Date() };
      where.completed_at = null;
    }

    const activities = await CrmActivity.findAll({
      where,
      include: [
        { model: User, as: 'owner', attributes: ['id', 'first_name', 'last_name'] }
      ],
      order: [['due_at', 'ASC']]
    });

    const results = activities.map(act => ({
      ...act.toJSON(),
      owner_name: act.owner ? `${act.owner.first_name} ${act.owner.last_name}` : 'Unassigned',
      related_name: ''
    }));

    const types = {};
    for (const r of results) {
      if (r.related_type && r.related_id) {
        if (!types[r.related_type]) types[r.related_type] = new Set();
        types[r.related_type].add(r.related_id);
      }
    }

    const dict = {};
    if (types.deal && types.deal.size > 0) {
      const deals = await CrmDeal.findAll({ where: { id: Array.from(types.deal) }, attributes: ['id', 'title'] });
      deals.forEach(d => dict[`deal_${d.id}`] = d.title);
    }
    if (types.lead && types.lead.size > 0) {
      const leads = await CrmLead.findAll({ where: { id: Array.from(types.lead) }, attributes: ['id', 'name'] });
      leads.forEach(l => dict[`lead_${l.id}`] = l.name);
    }
    if (types.customer && types.customer.size > 0) {
      const customers = await CrmCustomer.findAll({ where: { id: Array.from(types.customer) }, attributes: ['id', 'name', 'company_name'] });
      customers.forEach(c => dict[`customer_${c.id}`] = c.company_name || c.name);
    }
    if (types.quote && types.quote.size > 0) {
      const quotes = await CrmQuote.findAll({ where: { id: Array.from(types.quote) }, attributes: ['id', 'quote_no'] });
      quotes.forEach(q => dict[`quote_${q.id}`] = q.quote_no);
    }

    for (const r of results) {
      if (r.related_type && r.related_id) {
        r.related_name = dict[`${r.related_type}_${r.related_id}`] || `#${r.related_id}`;
      }
    }

    return results;
  },

  async deleteActivity({ id, tenantId, userId }) {
    const activity = await CrmActivity.findOne({ where: { id, tenant_id: tenantId } });
    if (!activity) throw new Error('Activity not found.');
    
    const outlookEventId = activity.outlook_event_id;
    await activity.destroy();

    try {
      if (outlookEventId && userId) {
        const user = await User.findByPk(userId);
        if (user && user.outlook_connected) {
          const outlookCalendarService = require('./outlookCalendarService');
          await outlookCalendarService.deleteEventFromOutlook(user, outlookEventId);
        }
      }
    } catch (err) {
      console.error('Failed to delete activity from outlook:', err);
    }

    return true;
  },

  async updateActivity({ id, tenantId, data }) {
    const activity = await CrmActivity.findOne({ where: { id, tenant_id: tenantId } });
    
    if (!activity) {
      throw new Error('Activity not found.');
    }

    const beforeData = activity.toJSON();
    const { due_at, title, description, completed_at, owner_id } = data;

    if (due_at !== undefined) activity.due_at = due_at;
    if (title !== undefined) activity.title = title;
    if (description !== undefined) activity.description = description;
    if (completed_at !== undefined) activity.completed_at = completed_at;
    if (owner_id !== undefined) activity.owner_id = owner_id;

    await activity.save();

    try {
      if (data.userId) { // Passed from controller
        const user = await User.findByPk(data.userId);
        if (user && user.outlook_connected) {
          const outlookCalendarService = require('./outlookCalendarService');
          await outlookCalendarService.pushEventToOutlook(user, activity);
        }
      }
    } catch (err) {
      console.error('Failed to sync updated activity to outlook:', err);
    }

    return { activity, beforeData };
  }
};

module.exports = crmActivityService;
