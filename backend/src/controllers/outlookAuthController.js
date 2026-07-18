'use strict';

const outlookCalendarService = require('../services/outlookCalendarService');
const { User } = require('../models');
const { sendSuccess, sendError } = require('../utils/response');

const outlookAuthController = {
  /**
   * GET /crm/outlook/connect
   * Initiates the Microsoft OAuth2 flow by redirecting to the Microsoft login page.
   * The state parameter carries the user ID so we know who to save the tokens for.
   */
  async initiateOAuth(req, res) {
    try {
      // Encode user ID and tenant ID in the state so the callback can identify the user
      const state = Buffer.from(JSON.stringify({
        userId: req.user.id,
        tenantId: req.tenantId,
      })).toString('base64');

      const authUrl = outlookCalendarService.getOAuthUrl(state);
      return res.redirect(authUrl);
    } catch (error) {
      console.error('[Outlook] Failed to initiate OAuth:', error.message);
      const frontendUrl = process.env.FRONTEND_URL || 'https://billify-crm-frontend.vercel.app';
      return res.redirect(`${frontendUrl}/crm/admin/settings?outlook_error=config`);
    }
  },

  /**
   * GET /auth/outlook/callback
   * Microsoft redirects here with ?code=... after user grants permission.
   * We exchange the code for tokens and save them to the user record.
   */
  async handleCallback(req, res) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://billify-crm-frontend.vercel.app';

    try {
      const { code, state, error: oauthError } = req.query;

      if (oauthError) {
        console.error('[Outlook] OAuth error from Microsoft:', oauthError);
        return res.redirect(`${frontendUrl}/crm/admin/settings?outlook_error=${oauthError}`);
      }

      if (!code || !state) {
        return res.redirect(`${frontendUrl}/crm/admin/settings?outlook_error=missing_params`);
      }

      // Decode state to get user info
      let stateData;
      try {
        stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
      } catch {
        return res.redirect(`${frontendUrl}/crm/admin/settings?outlook_error=invalid_state`);
      }

      const { userId, tenantId } = stateData;

      // Fetch the user from DB
      const user = await User.findOne({ where: { id: userId, business_id: tenantId } });
      if (!user) {
        return res.redirect(`${frontendUrl}/crm/admin/settings?outlook_error=user_not_found`);
      }

      // Exchange authorization code for tokens
      const tokens = await outlookCalendarService.exchangeCodeForTokens(code);

      // Save tokens to the user
      const expiry = new Date(Date.now() + tokens.expires_in * 1000);
      await user.update({
        outlook_access_token: tokens.access_token,
        outlook_refresh_token: tokens.refresh_token,
        outlook_token_expiry: expiry,
      });

      console.log(`[Outlook] Successfully connected Outlook for user ${userId}`);
      return res.redirect(`${frontendUrl}/crm/admin/settings?outlook_connected=true`);
    } catch (error) {
      console.error('[Outlook] Callback error:', error.message);
      return res.redirect(`${frontendUrl}/crm/admin/settings?outlook_error=token_exchange_failed`);
    }
  },

  /**
   * GET /crm/outlook/status
   * Returns whether the current user has Outlook connected and when it expires.
   */
  async getConnectionStatus(req, res) {
    try {
      const user = await User.findByPk(req.user.id);

      const isConnected = !!(user.outlook_access_token && user.outlook_refresh_token);

      return sendSuccess(res, {
        connected: isConnected,
        expires_at: user.outlook_token_expiry || null,
      }, 'Outlook connection status retrieved.');
    } catch (error) {
      return sendError(res, error.message || 'Failed to get Outlook status.', 500);
    }
  },

  /**
   * DELETE /crm/outlook/disconnect
   * Removes stored Outlook tokens — effectively disconnecting Outlook.
   */
  async disconnect(req, res) {
    try {
      const user = await User.findByPk(req.user.id);

      await user.update({
        outlook_access_token: null,
        outlook_refresh_token: null,
        outlook_token_expiry: null,
      });

      return sendSuccess(res, null, 'Outlook disconnected successfully.');
    } catch (error) {
      return sendError(res, error.message || 'Failed to disconnect Outlook.', 500);
    }
  },

  /**
   * GET /crm/outlook/events?start=...&end=...
   * Fetches calendar events from the user's Outlook account for a given date range.
   */
  async getEvents(req, res) {
    try {
      const { start, end } = req.query;

      if (!start || !end) {
        return sendError(res, 'start and end query parameters are required.', 400);
      }

      const user = await User.findByPk(req.user.id);

      if (!user.outlook_refresh_token) {
        return sendSuccess(res, [], 'Outlook not connected — no events returned.');
      }

      const events = await outlookCalendarService.getCalendarEvents(user, start, end);
      return sendSuccess(res, events, `${events.length} Outlook events retrieved.`);
    } catch (error) {
      console.error('[Outlook] Failed to fetch events:', error.message);
      // If token is invalid, tell the frontend to reconnect
      if (error.response?.status === 401) {
        return sendError(res, 'Outlook session expired. Please reconnect your Outlook account.', 401);
      }
      return sendError(res, error.message || 'Failed to fetch Outlook events.', 500);
    }
  },
};

module.exports = outlookAuthController;
