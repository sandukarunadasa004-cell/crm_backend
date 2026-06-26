'use strict';

const { Op } = require('sequelize');
const { CrmInteraction, CrmNotification, CrmCustomer, User } = require('../models');

const crmInboxService = {
  

  async getInbox(tenantId, userId, params = {}) {
    const { channel, search, date, page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    let interactions = [];
    let notifications = [];
    
    
    const queryInteractions = !channel || channel !== 'notification';
    const queryNotifications = !channel || channel === 'notification';

    
    if (queryInteractions) {
      const whereClause = { tenant_id: tenantId };
      if (channel && channel !== 'all') {
        whereClause.channel = channel;
      }

      if (search) {
        whereClause.summary = { [Op.like]: `%${search}%` };
      }

      if (date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        whereClause.interaction_at = {
          [Op.gte]: startOfDay,
          [Op.lte]: endOfDay
        };
      }

      interactions = await CrmInteraction.findAll({
        where: whereClause,
        include: [
          { model: CrmCustomer, as: 'customer', attributes: ['id', 'name', 'company_name'] },
          { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] }
        ],
        order: [['interaction_at', 'DESC']],
        limit,
        offset
      });
      
      interactions = interactions.map(i => {
        const item = i.toJSON();
        return {
          id: `interaction_${item.id}`,
          originalId: item.id,
          type: 'interaction',
          channel: item.channel,
          direction: item.direction,
          title: item.summary,
          timestamp: item.interaction_at,
          customer: item.customer,
          creator: item.creator,
          related_type: item.related_type,
          related_id: item.related_id,
          attachment_url: item.attachment_url,
          attachment_name: item.attachment_name
        };
      });
    }

    
    if (queryNotifications) {
      const whereClause = { tenant_id: tenantId, user_id: userId };
      
      if (search) {
        whereClause[Op.or] = [
          { title: { [Op.like]: `%${search}%` } },
          { body: { [Op.like]: `%${search}%` } }
        ];
      }

      if (date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        whereClause.created_at = {
          [Op.gte]: startOfDay,
          [Op.lte]: endOfDay
        };
      }

      notifications = await CrmNotification.findAll({
        where: whereClause,
        order: [['created_at', 'DESC']],
        limit,
        offset
      });
      
      notifications = notifications.map(n => {
        const item = n.toJSON();
        return {
          id: `notification_${item.id}`,
          originalId: item.id,
          type: 'notification',
          channel: 'notification', 
          direction: 'inbound',
          title: item.title,
          body: item.body,
          timestamp: item.createdAt || item.created_at,
          read_at: item.read_at,
          link: item.link,
          level: item.type 
        };
      });
    }

    
    const combined = [...interactions, ...notifications].sort((a, b) => {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    
    
    
    
    
    
    const feed = combined.slice(0, limit);

    return feed;
  },

  

  async getInboxStats(tenantId, userId) {
    const [
      totalInteractions,
      emailCount,
      whatsappCount,
      callCount,
      unreadNotifications
    ] = await Promise.all([
      CrmInteraction.count({ where: { tenant_id: tenantId } }),
      CrmInteraction.count({ where: { tenant_id: tenantId, channel: 'email' } }),
      CrmInteraction.count({ where: { tenant_id: tenantId, channel: 'whatsapp' } }),
      CrmInteraction.count({ where: { tenant_id: tenantId, channel: 'call' } }),
      CrmNotification.count({ where: { tenant_id: tenantId, user_id: userId, read_at: null } })
    ]);

    return {
      total: totalInteractions + unreadNotifications,
      email: emailCount,
      whatsapp: whatsappCount,
      call: callCount,
      notifications: unreadNotifications
    };
  }
};

module.exports = crmInboxService;
