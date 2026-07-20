'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config/app');
const { User, RefreshToken, Tenant, RolePermission, UserTenant } = require('../models');
const { Op } = require('sequelize');

class AuthService {

  /**
   * Step 1 of login: verify credentials, return list of companies.
   * If only one company → auto-issue token (backward compatible).
   */
  async login(email, password) {
    // Find user by email (may belong to multiple companies)
    const user = await User.findOne({
      where: { email, is_active: true },
    });

    if (!user) {
      throw Object.assign(new Error('Invalid email or password.'), { statusCode: 401 });
    }

    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      throw Object.assign(new Error('Invalid email or password.'), { statusCode: 401 });
    }

    // Get all companies this user belongs to (via user_tenants junction)
    const userTenants = await UserTenant.findAll({
      where: { user_id: user.id, is_active: true },
      include: [{ model: Tenant, as: 'tenant', where: { is_active: true }, required: true }],
    });

    // Also include the primary company (business_id on user record) if not already in user_tenants
    let companies = userTenants.map(ut => ({
      id: ut.tenant.id,
      name: ut.tenant.name,
      role: ut.role,
    }));

    // Fall back to legacy single-tenant if user_tenants is empty
    if (companies.length === 0 && user.business_id) {
      const primaryTenant = await Tenant.findOne({ where: { id: user.business_id, is_active: true } });
      if (primaryTenant) {
        companies = [{ id: primaryTenant.id, name: primaryTenant.name, role: user.role }];
      }
    }

    if (companies.length === 0) {
      throw Object.assign(new Error('No active company found for this user.'), { statusCode: 403 });
    }

    // If exactly one company, auto-select and issue token immediately
    if (companies.length === 1) {
      const tenant = await Tenant.findByPk(companies[0].id);
      const roleInCompany = companies[0].role;
      return await this._issueTokensForUserAndTenant(user, tenant, roleInCompany);
    }

    // Multiple companies → return company list, let user pick
    return {
      requiresCompanySelection: true,
      userId: user.id,
      // issue a short-lived "company selection token" so the next step is authenticated
      selectionToken: this._generateSelectionToken(user.id),
      companies,
    };
  }

  /**
   * Step 2 (only called when user has multiple companies):
   * User picks a company, we issue the real access token.
   */
  async selectCompany(userId, tenantId) {
    const user = await User.findOne({ where: { id: userId, is_active: true } });
    if (!user) throw Object.assign(new Error('User not found.'), { statusCode: 401 });

    const tenant = await Tenant.findOne({ where: { id: tenantId, is_active: true } });
    if (!tenant) throw Object.assign(new Error('Company not found.'), { statusCode: 404 });

    // Verify user belongs to this tenant
    let roleInCompany = user.role;
    const userTenant = await UserTenant.findOne({
      where: { user_id: userId, tenant_id: tenantId, is_active: true },
    });
    if (!userTenant && user.business_id !== tenantId) {
      throw Object.assign(new Error('Access denied to this company.'), { statusCode: 403 });
    }
    if (userTenant) roleInCompany = userTenant.role;

    return await this._issueTokensForUserAndTenant(user, tenant, roleInCompany);
  }

  /**
   * Switch company for an already-authenticated user (inline switcher).
   * Returns a new access token with updated tenantId.
   */
  async switchCompany(userId, targetTenantId) {
    return this.selectCompany(userId, targetTenantId);
  }

  /**
   * Get all companies a user can access.
   */
  async getUserCompanies(userId) {
    const user = await User.findOne({ where: { id: userId, is_active: true } });
    if (!user) throw Object.assign(new Error('User not found.'), { statusCode: 401 });

    const userTenants = await UserTenant.findAll({
      where: { user_id: userId, is_active: true },
      include: [{ model: Tenant, as: 'tenant', where: { is_active: true }, required: true }],
    });

    let companies = userTenants.map(ut => ({
      id: ut.tenant.id,
      name: ut.tenant.name,
      role: ut.role,
    }));

    // Also include primary tenant if not in junction table
    if (user.business_id && !companies.find(c => c.id === user.business_id)) {
      const primaryTenant = await Tenant.findOne({ where: { id: user.business_id, is_active: true } });
      if (primaryTenant) {
        companies.unshift({ id: primaryTenant.id, name: primaryTenant.name, role: user.role });
      }
    }

    return companies;
  }

  /**
   * Internal: issue access + refresh tokens for a user+tenant combination.
   */
  async _issueTokensForUserAndTenant(user, tenant, roleInCompany) {
    const rolePerms = await RolePermission.findAll({
      where: { role: roleInCompany, business_id: tenant.id },
    });
    const permissions = rolePerms.map(rp => rp.permission);

    const accessToken = this._generateAccessToken(user, tenant, roleInCompany);
    const refreshToken = await this.generateRefreshToken(user.id, tenant.id);

    const safeUser = user.toSafeJSON();
    safeUser.roles = [roleInCompany];
    safeUser.permissions = permissions;

    return {
      requiresCompanySelection: false,
      accessToken,
      refreshToken: refreshToken.token,
      user: safeUser,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        currency: 'LKR',
      },
    };
  }

  _generateSelectionToken(userId) {
    return jwt.sign(
      { userId, type: 'company_selection' },
      config.jwt.accessSecret,
      { expiresIn: '5m' }
    );
  }

  _generateAccessToken(user, tenant, role) {
    return jwt.sign(
      {
        userId: user.id,
        tenantId: tenant.id,
        email: user.email,
        role: role || user.role,
        tenantName: tenant.name,
      },
      config.jwt.accessSecret,
      { expiresIn: config.jwt.accessExpiry }
    );
  }

  // Keep backward compat alias
  generateAccessToken(user, tenant) {
    return this._generateAccessToken(user, tenant, user.role);
  }

  async generateRefreshToken(userId, businessId) {
    const token = jwt.sign(
      { userId, type: 'refresh' },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiry }
    );

    const decoded = jwt.decode(token);
    const expiresAt = new Date(decoded.exp * 1000);

    const refreshToken = await RefreshToken.create({
      user_id: userId,
      business_id: businessId,
      token,
      expires_at: expiresAt,
      is_revoked: false,
    });

    return refreshToken;
  }

  async refreshAccessToken(refreshTokenStr) {
    let decoded;
    try {
      decoded = jwt.verify(refreshTokenStr, config.jwt.refreshSecret);
    } catch {
      throw Object.assign(new Error('Invalid or expired refresh token.'), { statusCode: 401 });
    }

    const storedToken = await RefreshToken.findOne({
      where: {
        token: refreshTokenStr,
        user_id: decoded.userId,
        is_revoked: false,
        expires_at: { [Op.gt]: new Date() },
      },
    });

    if (!storedToken) {
      throw Object.assign(new Error('Refresh token not found or revoked.'), { statusCode: 401 });
    }

    const user = await User.findOne({ where: { id: decoded.userId, is_active: true } });
    if (!user) throw Object.assign(new Error('User not found.'), { statusCode: 401 });

    const tenant = await Tenant.findOne({ where: { id: storedToken.business_id } });
    if (!tenant) throw Object.assign(new Error('Tenant not found.'), { statusCode: 401 });

    const accessToken = this._generateAccessToken(user, tenant, user.role);
    return { accessToken };
  }

  async logout(userId, refreshTokenStr) {
    if (refreshTokenStr) {
      await RefreshToken.update(
        { is_revoked: true },
        { where: { user_id: userId, token: refreshTokenStr } }
      );
    }
  }

  async revokeAllTokens(userId) {
    await RefreshToken.update(
      { is_revoked: true },
      { where: { user_id: userId, is_revoked: false } }
    );
  }
}

module.exports = new AuthService();
