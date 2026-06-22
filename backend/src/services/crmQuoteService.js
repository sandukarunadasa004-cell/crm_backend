'use strict';

const { Op } = require('sequelize');
const { CrmQuote, CrmQuoteItem, CrmCustomer, User, sequelize } = require('../models');

const crmQuoteService = {
  async getAllQuotes({ tenantId, limit, offset, search, status, customer_id }) {
    const whereClause = { tenant_id: tenantId };
    
    if (status) whereClause.status = status;
    if (customer_id) whereClause.customer_id = customer_id;

    if (search) {
      whereClause[Op.or] = [
        { quote_no: { [Op.like]: `%${search}%` } },
        { title: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await CrmQuote.findAndCountAll({
      where: whereClause,
      include: [
        { model: CrmCustomer, as: 'customer', attributes: ['id', 'name', 'company_name'] },
        { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name'] },
        { model: CrmQuoteItem, as: 'items' }
      ],
      limit,
      offset,
      order: [['created_at', 'DESC']]
    });

    return { count, rows };
  },

  async getQuoteById(quoteId, tenantId) {
    const quote = await CrmQuote.findOne({
      where: { id: quoteId, tenant_id: tenantId },
      include: [
        { model: CrmCustomer, as: 'customer', attributes: ['id', 'name', 'email', 'phone', 'company_name'] },
        { model: CrmQuoteItem, as: 'items' },
        { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name', 'email'] }
      ]
    });

    if (!quote) throw new Error('Quote not found.');
    return quote;
  },

  async createQuote({ tenantId, data, userId }) {
    const { customer_id, lead_id, deal_id, title, items, discount_amount, tax_amount, notes, terms, valid_until, status } = data;

    if (!customer_id || !title || !items || items.length === 0) {
      throw new Error('Customer, title, and at least one item are required.');
    }

    const transaction = await sequelize.transaction();
    try {
      const count = await CrmQuote.count({ where: { tenant_id: tenantId }, paranoid: false, transaction });
      const quote_no = `QT-${String(count + 1).padStart(4, '0')}`;

      let subtotal_lkr = 0;
      items.forEach(item => {
        subtotal_lkr += (item.unit_price * item.quantity);
      });

      const total_lkr = subtotal_lkr - (discount_amount || 0) + (tax_amount || 0);

      const newQuote = await CrmQuote.create({
        tenant_id: tenantId,
        quote_no,
        customer_id,
        lead_id: lead_id || null,
        deal_id: deal_id || null,
        title,
        status: status || 'draft',
        valid_until: valid_until || null,
        subtotal_lkr,
        discount_lkr: discount_amount || 0,
        tax_lkr: tax_amount || 0,
        total_lkr,
        notes,
        terms,
        created_by: userId
      }, { transaction });

      const quoteItemsData = items.map(item => ({
        tenant_id: tenantId,
        quote_id: newQuote.id,
        product_id: item.product_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.unit_price * item.quantity
      }));

      await CrmQuoteItem.bulkCreate(quoteItemsData, { transaction });

      await transaction.commit();

      
      const completeQuote = await CrmQuote.findOne({
        where: { id: newQuote.id },
        include: [{ model: CrmQuoteItem, as: 'items' }]
      });

      return { quote: completeQuote, quote_no, total_lkr };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async updateQuote(quoteId, tenantId, updateData) {
    const quote = await CrmQuote.findOne({ where: { id: quoteId, tenant_id: tenantId } });
    if (!quote) throw new Error('Quote not found.');

    delete updateData.id;
    delete updateData.tenant_id;
    delete updateData.quote_no;

    if (updateData.deal_id === '') updateData.deal_id = null;
    if (updateData.lead_id === '') updateData.lead_id = null;

    if (updateData.discount_amount !== undefined) {
      updateData.discount_lkr = updateData.discount_amount;
      delete updateData.discount_amount;
    }
    if (updateData.tax_amount !== undefined) {
      updateData.tax_lkr = updateData.tax_amount;
      delete updateData.tax_amount;
    }

    const beforeData = quote.toJSON();
    await quote.update(updateData);

    return { quote, beforeData };
  },

  async updateQuoteStatus(quoteId, tenantId, status) {
    const { CrmDeal, CrmDealStage, CrmDealStageHistory } = require('../models');

    const quote = await CrmQuote.findOne({ where: { id: quoteId, tenant_id: tenantId } });
    if (!quote) throw new Error('Quote not found.');
    if (!status) throw new Error('Status is required.');

    const oldStatus = quote.status;
    await quote.update({ status });

    
    if (quote.deal_id && (status === 'accepted' || status === 'rejected')) {
      try {
        const deal = await CrmDeal.findOne({
          where: { id: quote.deal_id, tenant_id: tenantId }
        });

        if (deal && deal.status === 'open') {
          if (status === 'accepted') {
            
            const wonStage = await CrmDealStage.findOne({
              where: { tenant_id: tenantId, is_won_stage: true },
              order: [['sort_order', 'DESC']]
            });

            if (wonStage) {
              const oldStageId = deal.stage_id;
              await deal.update({
                stage_id: wonStage.id,
                status: 'won',
                probability: 100
              });
              await CrmDealStageHistory.create({
                tenant_id: tenantId,
                deal_id: deal.id,
                from_stage_id: oldStageId,
                to_stage_id: wonStage.id,
                changed_by: quote.created_by,
                changed_at: new Date()
              });
              console.log(`[Quote Accepted] Deal ${deal.id} auto-moved to Closed Won (stage ${wonStage.id})`);
            }
          } else if (status === 'rejected') {
            
            const lostStage = await CrmDealStage.findOne({
              where: { tenant_id: tenantId, is_lost_stage: true },
              order: [['sort_order', 'DESC']]
            });

            if (lostStage) {
              const oldStageId = deal.stage_id;
              await deal.update({
                stage_id: lostStage.id,
                status: 'lost',
                won_lost_reason: 'Quote rejected by customer'
              });
              await CrmDealStageHistory.create({
                tenant_id: tenantId,
                deal_id: deal.id,
                from_stage_id: oldStageId,
                to_stage_id: lostStage.id,
                changed_by: quote.created_by,
                changed_at: new Date()
              });
              console.log(`[Quote Rejected] Deal ${deal.id} auto-moved to Closed Lost (stage ${lostStage.id})`);
            }
          }
        }
      } catch (dealErr) {
        
        console.error('[Auto Deal Sync] Failed to update linked deal:', dealErr.message);
      }
    }
    

    return { quote, oldStatus };
  },

  async convertToInvoice(quoteId, tenantId, userId) {
    const crypto = require('crypto');
    const { Bill, BillItem, CrmCustomer } = require('../models');
    
    const transaction = await sequelize.transaction();
    try {
      const quote = await CrmQuote.findOne({
        where: { id: quoteId, tenant_id: tenantId },
        include: [
          { model: CrmQuoteItem, as: 'items' },
          { model: CrmCustomer, as: 'customer' }
        ],
        transaction
      });
      
      if (!quote) throw new Error('Quote not found.');
      if (quote.status === 'converted') throw new Error('Quote is already converted to an invoice.');

      const billId = crypto.randomUUID();
      const billNo = `INV-${Date.now().toString().slice(-6)}`;
      
      const bill = await Bill.create({
        id: billId,
        business_id: tenantId,
        bill_number: billNo,
        transaction_type: 'sale',
        sale_type: 'invoice',
        status: 'unpaid',
        customer_id: quote.customer_id,
        customer_name: quote.customer ? quote.customer.name : 'Unknown Customer',
        customer_mobile: quote.customer ? quote.customer.phone : null,
        subtotal: quote.subtotal_lkr,
        discount_amount: quote.discount_lkr,
        tax_amount: quote.tax_lkr,
        total: quote.total_lkr,
        paid_amount: 0,
        change_amount: 0,
        amount_tendered: 0,
        bill_date: new Date(),
        notes: `Generated from Quote: ${quote.quote_no}`,
      }, { transaction });

      if (quote.items && quote.items.length > 0) {
        const billItemsData = quote.items.map(item => ({
          id: crypto.randomUUID(),
          bill_id: billId,
          business_id: tenantId,
          product_id: item.product_id,
          name: item.item_name,
          quantity: item.qty,
          unit_price: item.unit_price_lkr,
          discount_amount: item.discount_lkr || 0,
          line_total: item.line_total_lkr,
          tax_amount: item.tax_lkr || 0,
        }));
        await BillItem.bulkCreate(billItemsData, { transaction });
      }

      await quote.update({ status: 'converted' }, { transaction });

      await transaction.commit();
      return bill;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async deleteQuote(quoteId, tenantId) {
    const quote = await CrmQuote.findOne({ where: { id: quoteId, tenant_id: tenantId } });
    if (!quote) throw new Error('Quote not found.');

    await quote.destroy();
    return quote;
  }
};

module.exports = crmQuoteService;
