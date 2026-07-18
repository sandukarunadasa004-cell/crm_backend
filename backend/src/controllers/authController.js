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
      const { email, password, tenantSlug } = req.body;

      if (!email || !password || !tenantSlug) {
        return sendError(res, 'Email, password, and business name are required.', 400);
      }

      const result = await authService.login(
        email,
        password,
        tenantSlug,
        req.ip,
        req.get('User-Agent')
      );

      await logAudit({
        tenantId: result.tenant.id,
        userId: result.user.id,
        action: 'login',
        entityType: 'user',
        entityId: result.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        description: `User ${result.user.email} logged in.`,
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
