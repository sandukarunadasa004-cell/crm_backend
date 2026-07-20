'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config/app');
const { User, Tenant, RolePermission } = require('../models');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.accessSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired. Please refresh your token.',
          code: 'TOKEN_EXPIRED',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid token.',
      });
    }

    const user = await User.findOne({
      where: { id: decoded.userId, status: 'active' },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive.',
      });
    }

    const activeTenantId = decoded.tenantId;

    const tenant = await Tenant.findOne({
      where: { id: activeTenantId },
    });

    if (!tenant || !tenant.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Tenant account is inactive or suspended.',
      });
    }

    // Role comes from token since user can have different roles in different companies
    const activeRole = decoded.role || user.role;

    const rolePerms = await RolePermission.findAll({
      where: { role: activeRole, business_id: activeTenantId }
    });
    
    const permissionSet = new Set();
    rolePerms.forEach(rp => {
      permissionSet.add(rp.permission);
    });

    
    req.user = {
      id: user.id,
      tenantId: activeTenantId, 
      email: user.email,
      firstName: user.name, 
      lastName: '',
      role: activeRole,
      roles: [activeRole], 
      permissions: permissionSet,
      tenant: tenant,
    };

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error.',
    });
  }
};

module.exports = { authenticate };
