'use strict';

const crmActivityService = require('../services/crmActivityService');
const emailService = require('../services/emailService');
const { sendSuccess, sendError, getPagination, getPaginationMeta } = require('../utils/response');
const { logAudit, getAuditContext } = require('../utils/auditLogger');

const crmActivityController = {
  async getInteractions(req, res) {
    try {
      const { page, limit, offset } = getPagination(req.query);
      const { channel } = req.query;

      const { count, rows } = await crmActivityService.getInteractions({
        tenantId: req.tenantId,
        limit,
        offset,
        channel
      });

      const paginationMeta = getPaginationMeta(count, page, limit);
      return sendSuccess(res, rows, 'Interactions retrieved successfully.', 200, paginationMeta);
    } catch (error) {
      console.error('Error fetching interactions:', error);
      return sendError(res, error.message || 'Failed to fetch interactions.', 500);
    }
  },

  async createInteraction(req, res) {
    try {
      const { interaction, formatted } = await crmActivityService.createInteraction({
        tenantId: req.tenantId,
        data: req.body,
        userId: req.user.id
      });

      await logAudit({
        ...getAuditContext(req),
        action: 'create',
        entityType: 'interaction',
        entityId: interaction.id,
        description: `Logged ${interaction.channel} communication for customer ID ${interaction.customer_id}`
      });

      return sendSuccess(res, formatted, 'Interaction logged successfully.', 201);
    } catch (error) {
      console.error('Error creating interaction:', error);
      const statusCode = error.message.includes('required') ? 400 : 500;
      return sendError(res, error.message || 'Failed to log interaction.', statusCode);
    }
  },

  async deleteInteraction(req, res) {
    try {
      await crmActivityService.deleteInteraction({ id: req.params.id, tenantId: req.tenantId });
      
      await logAudit({
        ...getAuditContext(req),
        action: 'delete',
        entityType: 'interaction',
        entityId: req.params.id,
        description: `Deleted communication log`
      });

      return sendSuccess(res, null, 'Interaction deleted successfully.');
    } catch (error) {
      console.error('Error deleting interaction:', error);
      const statusCode = error.message.includes('not found') ? 404 : 500;
      return sendError(res, error.message || 'Failed to delete interaction.', statusCode);
    }
  },


  async sendEmail(req, res) {
    try {
      const { customer_id, to, subject, body } = req.body;

      if (!customer_id || !to || !subject || !body) {
        return sendError(res, 'Customer, recipient email, subject, and body are required.', 400);
      }

      
      const emailUrl = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      
      const { interaction, formatted } = await crmActivityService.createInteraction({
        tenantId: req.tenantId,
        data: {
          customer_id,
          channel: 'email',
          direction: 'outbound',
          summary: `Subject: ${subject}\n\n${body}`
        },
        userId: req.user.id
      });

      await logAudit({
        ...getAuditContext(req),
        action: 'create',
        entityType: 'email',
        entityId: interaction.id,
        description: `Email interaction logged for ${to} — Subject: ${subject}`
      });

      return sendSuccess(res, { interaction: formatted, emailUrl }, 'Email interaction logged. Open the URL to send.', 201);
    } catch (error) {
      console.error('Error logging email:', error);
      return sendError(res, error.message || 'Failed to log email interaction.', 500);
    }
  },

  

  async sendWhatsApp(req, res) {
    try {
      const { customer_id, phone, message } = req.body;

      if (!customer_id || !phone || !message) {
        return sendError(res, 'Customer, phone number, and message are required.', 400);
      }

      
      let cleanPhone = phone.replace(/[\s\-()]/g, '');
      
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '94' + cleanPhone.substring(1);
      }
      
      if (cleanPhone.startsWith('+')) {
        cleanPhone = cleanPhone.substring(1);
      }

      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

      
      const { interaction, formatted } = await crmActivityService.createInteraction({
        tenantId: req.tenantId,
        data: {
          customer_id,
          channel: 'whatsapp',
          direction: 'outbound',
          summary: message
        },
        userId: req.user.id
      });

      await logAudit({
        ...getAuditContext(req),
        action: 'create',
        entityType: 'whatsapp',
        entityId: interaction.id,
        description: `WhatsApp message initiated to ${phone}`
      });

      return sendSuccess(res, { interaction: formatted, whatsappUrl }, 'WhatsApp interaction logged. Open the URL to send.', 201);
    } catch (error) {
      console.error('Error logging WhatsApp:', error);
      return sendError(res, error.message || 'Failed to log WhatsApp interaction.', 500);
    }
  },

  

  async getCalendarActivities(req, res) {
    try {
      const { start, end } = req.query;
      const activities = await crmActivityService.getCalendarActivities({
        tenantId: req.tenantId,
        start,
        end
      });
      return sendSuccess(res, activities, 'Calendar activities retrieved successfully.', 200);
    } catch (error) {
      console.error('Error fetching calendar activities:', error);
      return sendError(res, error.message || 'Failed to fetch calendar activities.', 500);
    }
  },

  async getActivities(req, res) {
    try {
      const { related_type, related_id, overdue } = req.query;
      const activities = await crmActivityService.getActivitiesByEntity({
        tenantId: req.tenantId,
        related_type,
        related_id,
        overdue,
        userId: req.user.id,
      });
      return sendSuccess(res, activities, 'Activities retrieved successfully.');
    } catch (error) {
      console.error('Error fetching activities:', error);
      return sendError(res, error.message || 'Failed to fetch activities.', 500);
    }
  },

  async deleteActivity(req, res) {
    try {
      await crmActivityService.deleteActivity({ id: req.params.id, tenantId: req.tenantId });
      return sendSuccess(res, null, 'Activity deleted successfully.');
    } catch (error) {
      console.error('Error deleting activity:', error);
      const statusCode = error.message.includes('not found') ? 404 : 500;
      return sendError(res, error.message || 'Failed to delete activity.', statusCode);
    }
  },

  async createActivity(req, res) {
    try {
      const activity = await crmActivityService.createActivity({
        tenantId: req.tenantId,
        data: req.body,
        userId: req.user.id
      });
      
      await logAudit({
        ...getAuditContext(req),
        action: 'create',
        entityType: 'activity',
        entityId: activity.id,
        description: `Created new activity: ${activity.title}`
      });

      return sendSuccess(res, activity, 'Activity created successfully.', 201);
    } catch (error) {
      console.error('Error creating activity:', error);
      const statusCode = error.message.includes('required') ? 400 : 500;
      return sendError(res, error.message || 'Failed to create activity.', statusCode);
    }
  },

  async updateActivity(req, res) {
    try {
      const { id } = req.params;
      const activity = await crmActivityService.updateActivity({
        id,
        tenantId: req.tenantId,
        data: req.body
      });

      await logAudit({
        ...getAuditContext(req),
        action: 'update',
        entityType: 'activity',
        entityId: activity.id,
        description: `Updated activity: ${activity.title}`
      });

      return sendSuccess(res, activity, 'Activity updated successfully.', 200);
    } catch (error) {
      console.error('Error updating activity:', error);
      const statusCode = error.message.includes('not found') ? 404 : 500;
      return sendError(res, error.message || 'Failed to update activity.', statusCode);
    }
  },

  async uploadEmail(req, res) {
    try {
      if (!req.file) {
        return sendError(res, 'No email file uploaded.', 400);
      }
      
      const fileExt = req.file.originalname.split('.').pop().toLowerCase();
      let parsedSubject = 'Uploaded Email';
      let parsedBody = 'No text extracted. See attached file.';

      if (fileExt === 'eml') {
        const fs = require('fs');
        const simpleParser = require('mailparser').simpleParser;
        const emlContent = fs.readFileSync(req.file.path);
        try {
          const parsed = await simpleParser(emlContent);
          parsedSubject = parsed.subject || parsedSubject;
          parsedBody = parsed.text || parsedBody;
        } catch (e) {
          console.error('Error parsing EML:', e);
        }
      } else if (fileExt === 'msg') {
        const fs = require('fs');
        const MsgReader = require('@kenjiuno/msgreader').default;
        try {
          const msgFileBuffer = fs.readFileSync(req.file.path);
          const msgReader = new MsgReader(msgFileBuffer);
          const fileData = msgReader.getFileData();
          parsedSubject = fileData.subject || parsedSubject;
          
          if (fileData.html) {
            const htmlStr = Buffer.from(fileData.html).toString('utf-8');
            
            parsedBody = htmlStr.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || parsedBody;
          }
        } catch (e) {
          console.error('Error parsing MSG:', e);
        }
      }

      const attachmentUrl = `/uploads/emails/${req.file.filename}`;
      const summaryText = `Subject: ${parsedSubject}\n\n${parsedBody}`;

      return sendSuccess(res, {
        attachment_url: attachmentUrl,
        attachment_name: req.file.originalname,
        summary: summaryText
      }, 'Email uploaded and parsed successfully.');
    } catch (error) {
      console.error('Error uploading email:', error);
      return sendError(res, error.message || 'Failed to process email file.', 500);
    }
  },

  async previewEmail(req, res) {
    try {
      const { file } = req.query;
      if (!file) {
        return sendError(res, 'File path is required.', 400);
      }

      
      const path = require('path');
      const fs = require('fs');
      const basename = path.basename(file);
      const filePath = path.join(__dirname, '../../uploads/emails', basename);

      if (!fs.existsSync(filePath)) {
        return sendError(res, 'Email file not found.', 404);
      }

      const ext = basename.split('.').pop().toLowerCase();

      if (ext === 'eml') {
        const simpleParser = require('mailparser').simpleParser;
        const emlContent = fs.readFileSync(filePath);
        const parsed = await simpleParser(emlContent);

        return sendSuccess(res, {
          from: parsed.from?.text || '',
          to: parsed.to?.text || '',
          cc: parsed.cc?.text || '',
          subject: parsed.subject || '(No Subject)',
          date: parsed.date ? parsed.date.toISOString() : null,
          html: parsed.html || null,
          text: parsed.text || '(No content)',
          attachments: (parsed.attachments || []).map(a => ({
            filename: a.filename,
            size: a.size,
            contentType: a.contentType
          }))
        }, 'Email parsed successfully.');
      } else if (ext === 'msg') {
        const MsgReader = require('@kenjiuno/msgreader').default;
        const msgFileBuffer = fs.readFileSync(filePath);
        const msgReader = new MsgReader(msgFileBuffer);
        const fileData = msgReader.getFileData();

        
        let toList = '';
        let ccList = '';
        if (fileData.recipients && Array.isArray(fileData.recipients)) {
          const toRecipients = fileData.recipients.filter(r => r.recipType === 'to' || r.recipType === undefined);
          const ccRecipients = fileData.recipients.filter(r => r.recipType === 'cc');
          toList = toRecipients.map(r => r.name || r.email || '').filter(Boolean).join(', ');
          ccList = ccRecipients.map(r => r.name || r.email || '').filter(Boolean).join(', ');
        }

        
        const attachments = (fileData.attachments || []).map(att => {
          const attData = msgReader.getAttachment(att);
          return {
            filename: attData.fileName || att.fileName || 'attachment',
            size: attData.content ? attData.content.length : 0,
            contentType: attData.mimeType || 'application/octet-stream'
          };
        });

        
        let htmlContent = null;
        let textContent = '(No content)';
        if (fileData.html) {
          htmlContent = Buffer.from(fileData.html).toString('utf-8');
          textContent = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }

        return sendSuccess(res, {
          from: fileData.senderName || fileData.senderEmail || '',
          to: toList,
          cc: ccList,
          subject: fileData.subject || '(No Subject)',
          date: fileData.creationTime || fileData.lastModificationTime || null,
          html: htmlContent,
          text: textContent,
          attachments
        }, 'MSG email parsed successfully.');
      } else {
        return sendSuccess(res, {
          from: '',
          to: '',
          cc: '',
          subject: basename,
          date: null,
          html: null,
          text: 'Preview is not available for this file format.',
          attachments: []
        }, 'Limited preview available.');
      }
    } catch (error) {
      console.error('Error previewing email:', error);
      return sendError(res, error.message || 'Failed to preview email.', 500);
    }
  }
};

module.exports = crmActivityController;
