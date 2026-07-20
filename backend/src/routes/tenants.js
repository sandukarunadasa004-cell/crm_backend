'use strict';

const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');
const { authenticate } = require('../middleware/auth');
const { sendError } = require('../utils/response');

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return sendError(res, 'Only admins can create new companies.', 403);
  }
  next();
};

router.post('/', authenticate, requireAdmin, tenantController.createTenant);
router.delete('/:id', authenticate, requireAdmin, tenantController.deleteTenant);

module.exports = router;
