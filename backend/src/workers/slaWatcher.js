'use strict';

const { Op } = require('sequelize');
const { CrmTicket, CrmNotification } = require('../models');
const { emitToTenant } = require('../socket');

class SlaWatcher {
  constructor() {
    this.intervalId = null;
    this.intervalMs = 60 * 1000; 
  }

  start() {
    if (this.intervalId) return;
    console.log('Starting SLA Watcher...');
    this.intervalId = setInterval(() => this.checkSlaBreaches(), this.intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('SLA Watcher stopped.');
    }
  }

  async checkSlaBreaches() {
    try {
      const now = new Date();

      
      const overdueTickets = await CrmTicket.findAll({
        where: {
          status: { [Op.notIn]: ['resolved', 'closed'] },
          due_at: { [Op.lt]: now },
          sla_alert_sent: false
        }
      });

      if (overdueTickets.length === 0) return;

      for (const ticket of overdueTickets) {
        
        await ticket.update({
          is_overdue: true,
          sla_alert_sent: true
        });

        
        const targetUserId = ticket.assignee_id || ticket.created_by;
        if (targetUserId) {
          const notification = await CrmNotification.create({
            tenant_id: ticket.tenant_id,
            user_id: targetUserId,
            title: `Action Required: Ticket #${ticket.ticket_no} Overdue`,
            body: `Ticket "${ticket.subject}" has exceeded its SLA time limit and is now overdue.`,
            type: 'warning',
            link: `/crm/tickets`
          });

          
          emitToTenant(ticket.tenant_id, 'notification:new', notification);
        }

        
        emitToTenant(ticket.tenant_id, 'ticket:sla_breach', ticket);
      }

    } catch (error) {
      console.error('Error in SLA Watcher:', error);
    }
  }
}

module.exports = new SlaWatcher();
