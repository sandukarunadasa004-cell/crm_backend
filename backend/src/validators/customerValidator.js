'use strict';

const { body } = require('express-validator');

const createCustomerRules = () => {
  return [
    body('name').trim().notEmpty().withMessage('Customer name is required'),
    body('type').optional().isIn(['individual', 'retail', 'wholesale', 'company', 'supplier', 'lead_only']).withMessage('Invalid customer type'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email format'),
    body('phone').optional().isString().isLength({ max: 20 }).withMessage('Phone cannot exceed 20 characters'),
  ];
};

const updateCustomerRules = () => {
  return [
    body('name').optional().trim().notEmpty().withMessage('Customer name cannot be empty'),
    body('type').optional().isIn(['individual', 'retail', 'wholesale', 'company', 'supplier', 'lead_only']).withMessage('Invalid customer type'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email format'),
    body('phone').optional().isString().isLength({ max: 20 }).withMessage('Phone cannot exceed 20 characters'),
    body('status').optional().isIn(['active', 'inactive', 'archived']).withMessage('Invalid status'),
  ];
};

module.exports = {
  createCustomerRules,
  updateCustomerRules
};
