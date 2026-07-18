'use strict';

const { Op } = require('sequelize');
const { CrmTicket, CrmTicketMessage, CrmCustomer, User } = require('../models');
const { emitToTenant, emitToTicket } = require('../socket');
const crmSlaService = require('./crmSlaService');

const crmTicketService = {
  async getAllTickets({ tenantId, limit, offset, search, status, priority, assignee_id, customer_id }) {
    const whereClause = { tenant_id: tenantId };
    
    if (status) whereClause.status = status;
    if (priority) whereClause.priority = priority;
    if (assignee_id) whereClause.assignee_id = assignee_id;
    if (customer_id) whereClause.customer_id = customer_id;

    if (search) {
      whereClause[Op.or] = [
        { subject: { [Op.like]: `%${search}%` } },
        { ticket_no: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await CrmTicket.findAndCountAll({
      where: whereClause,
      include: [
        { model: CrmCustomer, as: 'customer', attributes: ['id', 'name', 'company_name'] },
        { model: User, as: 'assignee', attributes: ['id', 'first_name', 'last_name'] }
      ],
      limit,
      offset,
      order: [['created_at', 'DESC']]
    });

    return { count, rows };
  },

  async getTicketById(ticketId, tenantId) {
    const ticket = await CrmTicket.findOne({
      where: { id: ticketId, tenant_id: tenantId },
      include: [
        { model: CrmCustomer, as: 'customer', attributes: ['id', 'name', 'email', 'phone'] },
        { model: User, as: 'assignee', attributes: ['id', 'first_name', 'last_name', 'email'] },
        { 
          model: CrmTicketMessage, 
          as: 'messages',
          include: [{ model: User, as: 'sender', attributes: ['id', 'first_name', 'last_name'] }]
        }
      ],
      order: [[{ model: CrmTicketMessage, as: 'messages' }, 'created_at', 'ASC']]
    });

    if (!ticket) throw new Error('Ticket not found.');
    return ticket;
  },

  async createTicket({ tenantId, data, userId }) {
    const { customer_id, subject, description, priority, category, assignee_id } = data;

    if (!customer_id || !subject) {
      throw new Error('Customer and subject are required.');
    }

    const count = await CrmTicket.count({ where: { tenant_id: tenantId }, paranoid: false });
    const ticket_no = `TKT-${String(count + 1).padStart(5, '0')}`;
    const ticketPriority = priority || 'medium';

    const newTicket = await CrmTicket.create({
      tenant_id: tenantId,
      ticket_no,
      customer_id,
      subject,
      description,
      status: 'open',
      priority: ticketPriority,
      category: category || 'general',
      assignee_id,
      due_at: crmSlaService.calculateDueAt(ticketPriority),
      is_overdue: false,
      sla_alert_sent: false,
      created_by: userId
    });

    emitToTenant(tenantId, 'ticket:new', newTicket);

    return newTicket;
  },

  async updateTicket(ticketId, tenantId, updateData) {
    const ticket = await CrmTicket.findOne({ where: { id: ticketId, tenant_id: tenantId } });
    if (!ticket) throw new Error('Ticket not found.');

    delete updateData.id;
    delete updateData.tenant_id;
    delete updateData.ticket_no;

    
    if (updateData.priority && updateData.priority !== ticket.priority) {
      updateData.due_at = crmSlaService.calculateDueAt(updateData.priority);
      updateData.is_overdue = false;
      updateData.sla_alert_sent = false;
    }

    const beforeData = ticket.toJSON();
    await ticket.update(updateData);

    emitToTenant(tenantId, 'ticket:updated', ticket);

    return { ticket, beforeData };
  },

  async addMessage({ ticketId, tenantId, userId, message, is_internal }) {
    const ticket = await CrmTicket.findOne({ where: { id: ticketId, tenant_id: tenantId } });
    if (!ticket) throw new Error('Ticket not found.');
    if (!message) throw new Error('Message content is required.');

    const newMessage = await CrmTicketMessage.create({
      tenant_id: tenantId,
      ticket_id: ticket.id,
      sender_user_id: userId,
      message,
      is_internal: is_internal || false
    });

    
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      await ticket.update({ status: 'open' });
      emitToTenant(tenantId, 'ticket:updated', ticket);
    }

    const emitData = { ticketId: ticket.id, message: newMessage };
    emitToTenant(tenantId, 'ticket:message', emitData);
    if (!is_internal) emitToTicket(ticket.id, 'ticket:message', emitData);

    return newMessage;
  },

  async deleteTicket(ticketId, tenantId) {
    const ticket = await CrmTicket.findOne({ where: { id: ticketId, tenant_id: tenantId } });
    if (!ticket) throw new Error('Ticket not found.');

    await ticket.destroy();
    return ticket;
  }
};

module.exports = crmTicketService;
