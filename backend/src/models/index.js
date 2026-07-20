'use strict';

const { Sequelize } = require('sequelize');
const config = require('../config/app');

const sequelize = new Sequelize(
  config.db.name,
  config.db.user,
  config.db.password,
  {
    host: config.db.host,
    port: config.db.port,
    dialect: config.db.dialect,
    logging: config.app.env === 'development' ? console.log : false,
    pool: config.db.pool,
    define: {
      timestamps: true,
      underscored: true,
      paranoid: true,
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
    },
    dialectOptions: {
      charset: 'utf8mb4',
      dateStrings: true,
      typeCast: true,
    },
    timezone: '+05:30',
  }
);

const User = require('./User')(sequelize);
const Tenant = require('./Tenant')(sequelize);
const RolePermission = require('./RolePermission')(sequelize);
const RefreshToken = require('./RefreshToken')(sequelize);

const CrmCustomer = require('./CrmCustomer')(sequelize);
const CrmCustomerContact = require('./CrmCustomerContact')(sequelize);
const CrmCustomerAddress = require('./CrmCustomerAddress')(sequelize);
const CrmLead = require('./CrmLead')(sequelize);
const CrmDeal = require('./CrmDeal')(sequelize);
const CrmDealStage = require('./CrmDealStage')(sequelize);
const CrmDealStageHistory = require('./CrmDealStageHistory')(sequelize);
const CrmQuote = require('./CrmQuote')(sequelize);
const CrmQuoteItem = require('./CrmQuoteItem')(sequelize);
const CrmTicket = require('./CrmTicket')(sequelize);
const CrmTicketMessage = require('./CrmTicketMessage')(sequelize);
const CrmActivity = require('./CrmActivity')(sequelize);
const CrmInteraction = require('./CrmInteraction')(sequelize);
const CrmDocument = require('./CrmDocument')(sequelize);
const CrmNotification = require('./CrmNotification')(sequelize);
const CrmAuditLog = require('./CrmAuditLog')(sequelize);
const CrmDealAutomationRule = require('./CrmDealAutomationRule')(sequelize);
const CrmCustomField = require('./CrmCustomField')(sequelize);
const CrmShopProfile = require('./CrmShopProfile')(sequelize);
const Product = require('./Product')(sequelize);
const CrmTodo = require('./CrmTodo')(sequelize);
const CrmLeadAssignee = require('./CrmLeadAssignee')(sequelize);
const UserTenant = require('./UserTenant')(sequelize);

const Bill = require('./pos/Bill')(sequelize);
const BillPayment = require('./pos/BillPayment')(sequelize);
const BillItem = require('./pos/BillItem')(sequelize);
const CustomerLedger = require('./pos/CustomerLedger')(sequelize);
const PosCustomer = require('./pos/Customer')(sequelize);
const Category = require('./pos/Category')(sequelize);

const db = {
  sequelize,
  Sequelize,
  User,
  Tenant,
  RolePermission,
  RefreshToken,
  CrmCustomer,
  CrmCustomerContact,
  CrmCustomerAddress,
  CrmLead,
  CrmDeal,
  CrmDealStage,
  CrmDealStageHistory,
  CrmQuote,
  CrmQuoteItem,
  CrmTicket,
  CrmTicketMessage,
  CrmActivity,
  CrmInteraction,
  CrmDocument,
  CrmNotification,
  CrmAuditLog,
  CrmDealAutomationRule,
  CrmCustomField,
  CrmShopProfile,
  Product,
  CrmTodo,
  CrmLeadAssignee,
  UserTenant,
  Bill,
  BillPayment,
  BillItem,
  CustomerLedger,
  PosCustomer,
  Category,
};

Tenant.hasMany(User, { foreignKey: 'business_id', as: 'users' });
User.belongsTo(Tenant, { foreignKey: 'business_id', as: 'tenant' });


User.belongsToMany(Tenant, { through: UserTenant, foreignKey: 'user_id', otherKey: 'tenant_id', as: 'companies' });
Tenant.belongsToMany(User, { through: UserTenant, foreignKey: 'tenant_id', otherKey: 'user_id', as: 'members' });
UserTenant.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
UserTenant.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

User.hasMany(RefreshToken, { foreignKey: 'user_id', as: 'refreshTokens' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

CrmTodo.belongsTo(Tenant, { foreignKey: 'tenant_id' });
CrmTodo.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(CrmTodo, { foreignKey: 'user_id', as: 'todos' });

CrmCustomer.belongsTo(Tenant, { foreignKey: 'tenant_id' });
CrmCustomer.belongsTo(PosCustomer, { foreignKey: 'billify_customer_id', as: 'posCustomer' });

CrmCustomer.hasMany(CrmCustomerContact, { foreignKey: 'customer_id', as: 'contacts' });
CrmCustomerContact.belongsTo(CrmCustomer, { foreignKey: 'customer_id', as: 'customer' });

CrmCustomer.hasMany(CrmCustomerAddress, { foreignKey: 'customer_id', as: 'addresses' });
CrmCustomerAddress.belongsTo(CrmCustomer, { foreignKey: 'customer_id', as: 'customer' });

Bill.hasMany(BillItem, { foreignKey: 'bill_id', as: 'items' });
BillItem.belongsTo(Bill, { foreignKey: 'bill_id', as: 'bill' });

Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Category.hasMany(Product, { foreignKey: 'category_id', as: 'products' });

CrmLead.belongsTo(CrmCustomer, { foreignKey: 'customer_id', as: 'customer' });
CrmLead.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });
CrmCustomer.hasMany(CrmLead, { foreignKey: 'customer_id', as: 'leads' });


CrmLead.belongsToMany(User, { through: CrmLeadAssignee, foreignKey: 'lead_id', otherKey: 'user_id', as: 'assignees' });
User.belongsToMany(CrmLead, { through: CrmLeadAssignee, foreignKey: 'user_id', otherKey: 'lead_id', as: 'assignedLeads' });
CrmLeadAssignee.belongsTo(CrmLead, { foreignKey: 'lead_id', as: 'lead' });
CrmLeadAssignee.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

CrmDeal.belongsTo(CrmCustomer, { foreignKey: 'customer_id', as: 'customer' });
CrmDeal.belongsTo(CrmLead, { foreignKey: 'lead_id', as: 'lead' });
CrmDeal.belongsTo(CrmDealStage, { foreignKey: 'stage_id', as: 'stage' });
CrmDeal.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });
CrmCustomer.hasMany(CrmDeal, { foreignKey: 'customer_id', as: 'deals' });

CrmDealStage.belongsTo(Tenant, { foreignKey: 'tenant_id' });
CrmDealStage.hasMany(CrmDeal, { foreignKey: 'stage_id', as: 'deals' });
CrmDealStage.hasMany(CrmDealAutomationRule, { foreignKey: 'stage_id', as: 'automationRules' });

CrmDealAutomationRule.belongsTo(Tenant, { foreignKey: 'tenant_id' });
CrmDealAutomationRule.belongsTo(CrmDealStage, { foreignKey: 'stage_id', as: 'stage' });

CrmDealStageHistory.belongsTo(CrmDeal, { foreignKey: 'deal_id', as: 'deal' });
CrmDealStageHistory.belongsTo(CrmDealStage, { foreignKey: 'from_stage_id', as: 'fromStage' });
CrmDealStageHistory.belongsTo(CrmDealStage, { foreignKey: 'to_stage_id', as: 'toStage' });
CrmDealStageHistory.belongsTo(User, { foreignKey: 'changed_by', as: 'changedByUser' });

CrmQuote.belongsTo(CrmCustomer, { foreignKey: 'customer_id', as: 'customer' });
CrmQuote.belongsTo(CrmLead, { foreignKey: 'lead_id', as: 'lead' });
CrmQuote.belongsTo(CrmDeal, { foreignKey: 'deal_id', as: 'deal' });
CrmQuote.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
CrmQuote.hasMany(CrmQuoteItem, { foreignKey: 'quote_id', as: 'items' });
CrmQuoteItem.belongsTo(CrmQuote, { foreignKey: 'quote_id', as: 'quote' });
CrmCustomer.hasMany(CrmQuote, { foreignKey: 'customer_id', as: 'quotes' });

CrmTicket.belongsTo(CrmCustomer, { foreignKey: 'customer_id', as: 'customer' });
CrmTicket.belongsTo(User, { foreignKey: 'assignee_id', as: 'assignee' });
CrmTicket.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
CrmTicket.hasMany(CrmTicketMessage, { foreignKey: 'ticket_id', as: 'messages' });
CrmTicketMessage.belongsTo(CrmTicket, { foreignKey: 'ticket_id', as: 'ticket' });
CrmTicketMessage.belongsTo(User, { foreignKey: 'sender_user_id', as: 'sender' });
CrmCustomer.hasMany(CrmTicket, { foreignKey: 'customer_id', as: 'tickets' });

CrmActivity.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

CrmInteraction.belongsTo(CrmCustomer, { foreignKey: 'customer_id', as: 'customer' });
CrmInteraction.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

CrmDocument.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });

CrmNotification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

CrmAuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = db;
