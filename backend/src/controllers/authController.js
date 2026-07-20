'use strict';

const authService = require('../services/authService');
const { sendSuccess, sendError } = require('../utils/response');
const { logAudit, getAuditContext } = require('../utils/auditLogger');
const config = require('../config/app');

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,                                        
  secure: config.app.env === 'production',               
  sameSite: config.app.env === 'production' ? 'None' : 'Lax', 
  maxAge: 30 * 24 * 60 * 60 * 1000,                      
  path: '/',
};

const authController = {

  
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return sendError(res, 'Email and password are required.', 400);
      }

      const result = await authService.login(
        email,
        password
      );

      if (result.requiresCompanySelection) {
        
        return sendSuccess(res, {
          requiresCompanySelection: true,
          selectionToken: result.selectionToken,
          companies: result.companies,
        }, 'Please select a company to continue.');
      }

      await logAudit({
        tenantId: result.tenant.id,
        userId: result.user.id,
        action: 'login',
        entityType: 'user',
        entityId: result.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        description: `User ${result.user.email} logged in to ${result.tenant.name}.`,
      });

      res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

      return sendSuccess(res, {
        accessToken: result.accessToken,
        user: result.user,
        tenant: result.tenant,
      }, 'Login successful.');
    } catch (error) {
      console.error('Login Error:', error);
      return sendError(res, error.message, error.statusCode || 500);
    }
  },

  async selectCompany(req, res) {
    try {
      const { selectionToken, tenantId } = req.body;
      if (!selectionToken || !tenantId) {
        return sendError(res, 'Selection token and company ID are required.', 400);
      }

      
      const jwt = require('jsonwebtoken');
      let decoded;
      try {
        decoded = jwt.verify(selectionToken, config.jwt.accessSecret);
      } catch (err) {
        return sendError(res, 'Invalid or expired selection token.', 401);
      }

      if (decoded.type !== 'company_selection') {
        return sendError(res, 'Invalid token type.', 401);
      }

      const result = await authService.selectCompany(decoded.userId, tenantId);

      await logAudit({
        tenantId: result.tenant.id,
        userId: result.user.id,
        action: 'login',
        entityType: 'user',
        entityId: result.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        description: `User ${result.user.email} selected company ${result.tenant.name}.`,
      });

      res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

      return sendSuccess(res, {
        accessToken: result.accessToken,
        user: result.user,
        tenant: result.tenant,
      }, 'Login successful.');
    } catch (error) {
      console.error('Select Company Error:', error);
      return sendError(res, error.message, error.statusCode || 500);
    }
  },

  async switchCompany(req, res) {
    try {
      const { tenantId } = req.body;
      if (!tenantId) {
        return sendError(res, 'Company ID is required.', 400);
      }

      const result = await authService.switchCompany(req.user.id, tenantId);

      await logAudit({
        tenantId: result.tenant.id,
        userId: result.user.id,
        action: 'switch_company',
        entityType: 'user',
        entityId: result.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        description: `User ${result.user.email} switched to company ${result.tenant.name}.`,
      });

      res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

      return sendSuccess(res, {
        accessToken: result.accessToken,
        user: result.user,
        tenant: result.tenant,
      }, 'Switched company successfully.');
    } catch (error) {
      console.error('Switch Company Error:', error);
      return sendError(res, error.message, error.statusCode || 500);
    }
  },

  async getMyCompanies(req, res) {
    try {
      const companies = await authService.getUserCompanies(req.user.id);
      return sendSuccess(res, companies, 'Companies retrieved.');
    } catch (error) {
      return sendError(res, error.message, error.statusCode || 500);
    }
  },

  
  async refreshToken(req, res) {
    try {
      
      const refreshTokenStr = req.cookies?.refreshToken || req.body?.refreshToken;

      if (!refreshTokenStr) {
        return sendError(res, 'Refresh token not found.', 401);
      }

      const result = await authService.refreshAccessToken(refreshTokenStr);
      return sendSuccess(res, result, 'Token refreshed successfully.');
    } catch (error) {
      
      res.clearCookie('refreshToken', { path: '/' });
      return sendError(res, error.message, error.statusCode || 401);
    }
  },

  
  async logout(req, res) {
    try {
      const refreshTokenStr = req.cookies?.refreshToken || req.body?.refreshToken;
      await authService.logout(req.user.id, refreshTokenStr);

      await logAudit({
        ...getAuditContext(req),
        action: 'logout',
        entityType: 'user',
        entityId: req.user.id,
        description: `User ${req.user.email} logged out.`,
      });

      
      res.clearCookie('refreshToken', { path: '/' });

      return sendSuccess(res, null, 'Logged out successfully.');
    } catch (error) {
      return sendError(res, error.message, error.statusCode || 500);
    }
  },

  
  async getMe(req, res) {
    try {
      return sendSuccess(res, {
        id: req.user.id,
        tenantId: req.user.tenantId,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        roles: req.user.roles,
        permissions: Array.from(req.user.permissions),
        tenant: req.user.tenant,
      }, 'User profile retrieved.');
    } catch (error) {
      return sendError(res, error.message, 500);
    }
  },

  
  async getUsers(req, res) {
    try {
      const { User } = require('../models');
      const users = await User.findAll({
        where: { business_id: req.tenantId, status: 'active' },
        attributes: ['id', 'first_name', 'last_name', 'email', 'role'],
        order: [['first_name', 'ASC']]
      });
      return sendSuccess(res, users, 'Users retrieved successfully.');
    } catch (error) {
      console.error('Error fetching users:', error);
      return sendError(res, error.message || 'Failed to fetch users.', 500);
    }
  },
};

module.exports = authController;
