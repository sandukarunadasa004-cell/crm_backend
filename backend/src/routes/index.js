'use strict';

const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Billify CRM API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

router.use('/auth', authRoutes);

router.use('/crm/dashboard', require('./crmDashboard'));
router.use('/crm/customers', require('./crmCustomers'));
router.use('/crm/leads', require('./crmLeads'));
router.use('/crm/deals', require('./crmDeals'));
router.use('/crm/quotes', require('./crmQuotes'));
router.use('/crm/tickets', require('./crmTickets'));

router.use('/crm/activities', require('./crmActivities'));
router.use('/crm/documents', require('./crmDocuments'));
router.use('/crm/admin/roles', require('./crmRoles'));
router.use('/crm/users', require('./crmUsers'));
router.use('/crm/payments', require('./crmPayments'));
router.use('/crm/reports', require('./crmReports'));
router.use('/crm/custom-fields', require('./crmCustomFields'));
router.use('/crm/shop-profile', require('./crmShopProfile'));
router.use('/crm/inbox', require('./crmInbox'));
router.use('/crm/notifications', require('./crmNotifications'));
router.use('/crm/todos', require('./crmTodos'));

module.exports = router;
