'use strict';

const { CrmCustomer, CrmTicket, CrmTicketMessage } = require('../models');
const { sendSuccess, sendError } = require('../utils/response');
const { emitToTenant } = require('../socket');
const crmSlaService = require('../services/crmSlaService');
const { isValidEmail, isValidPhone } = require('../utils/validators');

const publicSupportController = {
  
  async createTicket(req, res) {
    try {
      const tenantId = req.headers['x-tenant-id'];
      if (!tenantId) {
        return sendError(res, 'Missing x-tenant-id header.', 401);
      }

      const { name, email, phone, subject, description, priority } = req.body;

      if (!subject || !name || !email) {
        return sendError(res, 'Name, email, and subject are required.', 400);
      }

      if (email && !isValidEmail(email)) return sendError(res, 'Invalid email format.', 400);
      if (phone && !isValidPhone(phone)) return sendError(res, 'Invalid phone format.', 400);

      
      let customer = await CrmCustomer.findOne({ where: { email, tenant_id: tenantId } });
      if (!customer) {
        const count = await CrmCustomer.count({ where: { tenant_id: tenantId }, paranoid: false });
        customer = await CrmCustomer.create({
          tenant_id: tenantId,
          customer_code: `CUST-${String(count + 1).padStart(4, '0')}`,
          name,
          email,
          phone: phone || '',
          type: 'individual',
          status: 'active'
        });
      }

      
      const count = await CrmTicket.count({ where: { tenant_id: tenantId }, paranoid: false });
      const ticket_no = `TKT-${String(count + 1).padStart(5, '0')}`;
      const ticketPriority = priority || 'medium';

      const newTicket = await CrmTicket.create({
        tenant_id: tenantId,
        ticket_no,
        customer_id: customer.id,
        subject,
        description,
        status: 'open',
        priority: ticketPriority,
        category: 'general',
        source: 'portal',
        due_at: crmSlaService.calculateDueAt(ticketPriority),
        is_overdue: false,
        sla_alert_sent: false
      });

      emitToTenant(tenantId, 'ticket:new', newTicket);

      return sendSuccess(res, { ticket_no: newTicket.ticket_no, id: newTicket.id }, 'Ticket created successfully.', 201);
    } catch (error) {
      console.error('Error creating public ticket:', error);
      return sendError(res, 'Failed to create ticket.', 500);
    }
  },

  
  async getTicket(req, res) {
    try {
      const tenantId = req.headers['x-tenant-id'];
      if (!tenantId) return sendError(res, 'Missing x-tenant-id header.', 401);

      const ticket = await CrmTicket.findOne({
        where: { ticket_no: req.params.ticket_no, tenant_id: tenantId },
        include: [
          {
            model: CrmTicketMessage,
            as: 'messages',
            where: { is_internal: false, is_internal_note: false },
            required: false 
          }
        ],
        order: [[{ model: CrmTicketMessage, as: 'messages' }, 'created_at', 'ASC']]
      });

      if (!ticket) {
        return sendError(res, 'Ticket not found.', 404);
      }

      return sendSuccess(res, ticket, 'Ticket retrieved successfully.');
    } catch (error) {
      console.error('Error fetching public ticket:', error);
      return sendError(res, 'Failed to fetch ticket.', 500);
    }
  },

  
  async addMessage(req, res) {
    try {
      const tenantId = req.headers['x-tenant-id'];
      if (!tenantId) return sendError(res, 'Missing x-tenant-id header.', 401);

      const { message, sender_name } = req.body;
      if (!message) return sendError(res, 'Message is required.', 400);

      const ticket = await CrmTicket.findOne({ where: { ticket_no: req.params.ticket_no, tenant_id: tenantId } });
      if (!ticket) return sendError(res, 'Ticket not found.', 404);

      const newMessage = await CrmTicketMessage.create({
        tenant_id: tenantId,
        ticket_id: ticket.id,
        sender_name: sender_name || 'Customer', 
        message,
        is_internal: false
      });

      
      if (ticket.status === 'resolved' || ticket.status === 'closed') {
        await ticket.update({ status: 'open' });
        emitToTenant(tenantId, 'ticket:updated', ticket);
      }

      emitToTenant(tenantId, 'ticket:message', { ticketId: ticket.id, message: newMessage });

      return sendSuccess(res, newMessage, 'Message added successfully.', 201);
    } catch (error) {
      console.error('Error adding public message:', error);
      return sendError(res, 'Failed to add message.', 500);
    }
  }
};

module.exports = publicSupportController;
