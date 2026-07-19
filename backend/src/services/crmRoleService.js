'use strict';

const { User, RolePermission, sequelize } = require('../models');

const permissionModules = [
  'dashboard', 'customers', 'leads', 'deals', 'quotes',
  'tickets', 'activities', 'interactions', 'documents',
  'notifications', 'payments', 'products', 'reports', 'roles'
];
const permissionActions = ['view', 'create', 'update', 'delete', 'export', 'assign', 'manage'];

function getAllPermissionsList() {
  const allPerms = [];
  permissionModules.forEach(mod => {
    permissionActions.forEach(action => {
      allPerms.push({
        id: `crm_${mod}_${action}`,
        module: mod,
        action: action,
        description: `Can ${action} ${mod.replace('_', ' ')}`
      });
    });
  });
  return allPerms;
}

const crmRoleService = {
  async getRoles(tenantId) {
    const users = await User.findAll({
      where: { business_id: tenantId },
      attributes: ['id', 'role']
    });

    const baseRoleNames = ['super_admin', 'admin', 'sales_manager', 'sales_user', 'support_manager', 'support_agent', 'accountant', 'read_only'];
    
    
    
    const roleNames = baseRoleNames;

    const rolePermissions = await RolePermission.findAll({
      where: { business_id: tenantId }
    });

    const allPermissionsMap = getAllPermissionsList().reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});

    const roles = roleNames.map((roleName) => {
      const roleUsers = users.filter(u => u.role === roleName);
      const rPerms = rolePermissions.filter(rp => rp.role === roleName);
      
      const permissions = rPerms
        .map(rp => allPermissionsMap[rp.permission])
        .filter(Boolean);

      return {
        id: roleName, 
        name: roleName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        slug: roleName,
        description: `${roleName.charAt(0).toUpperCase() + roleName.slice(1).replace('_', ' ')} access role`,
        is_system: ['super_admin', 'admin'].includes(roleName),
        user_count: roleUsers.length,
        permissions: permissions
      };
    });

    return roles;
  },

  async getPermissions() {
    return getAllPermissionsList();
  },

  async updateRole({ roleId, tenantId, name, description, permission_ids }) {
    const roleName = roleId;
    
    if (roleName === 'super_admin') {
      throw new Error('Super Admin role cannot be modified');
    }

    const transaction = await sequelize.transaction();
    try {
      await sequelize.query(
        `DELETE FROM role_permissions WHERE business_id = :tenantId AND role = :roleName AND permission LIKE 'crm_%'`,
        { 
          replacements: { tenantId, roleName }, 
          transaction 
        }
      );

      if (Array.isArray(permission_ids) && permission_ids.length > 0) {
        const newPerms = permission_ids.map(pId => ({
          business_id: tenantId,
          role: roleName,
          permission: pId
        }));
        await RolePermission.bulkCreate(newPerms, { transaction });
      }

      await transaction.commit();
      
      return { 
        id: roleName,
        name: name || roleName,
        slug: roleName,
        description: description || '',
        updated: true
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};

module.exports = crmRoleService;
