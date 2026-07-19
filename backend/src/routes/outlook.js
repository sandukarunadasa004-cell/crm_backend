'use strict';

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');
const outlookAuthController = require('../controllers/outlookAuthController');

// All CRM Outlook routes require authentication + tenant
router.get('/connect', authenticate, tenantScope, outlookAuthController.initiateOAuth);
router.get('/status', authenticate, tenantScope, outlookAuthController.getConnectionStatus);
router.delete('/disconnect', authenticate, tenantScope, outlookAuthController.disconnect);
router.get('/events', authenticate, tenantScope, outlookAuthController.getEvents);

module.exports = router;
