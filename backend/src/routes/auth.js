'use strict';

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');

router.post('/login', authController.login);
router.post('/select-company', authController.selectCompany);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.get('/users', authenticate, tenantScope, authController.getUsers);
router.get('/my-companies', authenticate, authController.getMyCompanies);
router.post('/switch-company', authenticate, authController.switchCompany);

module.exports = router;
