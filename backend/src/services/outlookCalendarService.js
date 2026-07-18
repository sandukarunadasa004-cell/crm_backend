'use strict';

/**
 * Outlook Calendar Service
 * Handles all communication with Microsoft Graph API.
 * Uses OAuth 2.0 authorization code flow (per-user tokens).
 */

const axios = require('axios');

const MICROSOFT_AUTH_BASE = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

const SCOPES = [
  'offline_access',
  'User.Read',
  'Calendars.ReadWrite',
].join(' ');

const outlookCalendarService = {
  /**
   * Generate the OAuth authorization URL to redirect the user to Microsoft login.
   */
  getOAuthUrl(state) {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      throw new Error('Outlook OAuth is not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_REDIRECT_URI in .env');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: SCOPES,
      response_mode: 'query',
      state: state || 'default',
    });

    return `${MICROSOFT_AUTH_BASE}/authorize?${params.toString()}`;
  },

  /**
   * Exchange the authorization code (from callback) for access + refresh tokens.
   */
  async exchangeCodeForTokens(code) {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await axios.post(
      `${MICROSOFT_AUTH_BASE}/token`,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in, // seconds
    };
  },

  /**
   * Use the refresh token to get a new access token when expired.
   */
  async refreshAccessToken(refreshToken) {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: SCOPES,
    });

    const response = await axios.post(
      `${MICROSOFT_AUTH_BASE}/token`,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token || refreshToken,
      expires_in: response.data.expires_in,
    };
  },

  /**
   * Ensure the user has a valid, non-expired access token.
   * Refreshes automatically if expired.
   */
  async getValidAccessToken(user) {
    const now = new Date();
    const expiry = user.outlook_token_expiry ? new Date(user.outlook_token_expiry) : null;

    // If access token is still valid (with 5-minute buffer), return it
    if (user.outlook_access_token && expiry && expiry > new Date(now.getTime() + 5 * 60 * 1000)) {
      return user.outlook_access_token;
    }

    // Try to refresh using refresh token
    if (!user.outlook_refresh_token) {
      throw new Error('Outlook is not connected. Please connect your Outlook account first.');
    }

    const tokens = await this.refreshAccessToken(user.outlook_refresh_token);

    // Persist new tokens to the user record
    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);
    await user.update({
      outlook_access_token: tokens.access_token,
      outlook_refresh_token: tokens.refresh_token,
      outlook_token_expiry: newExpiry,
    });

    return tokens.access_token;
  },

  /**
   * Fetch calendar events from Outlook within a date range.
   * Returns an array of events normalized for the CRM calendar.
   */
  async getCalendarEvents(user, startDate, endDate) {
    const accessToken = await this.getValidAccessToken(user);

    const start = new Date(startDate).toISOString();
    const end = new Date(endDate).toISOString();

    const response = await axios.get(
      `${GRAPH_API_BASE}/me/calendarview?startDateTime=${start}&endDateTime=${end}&$select=id,subject,start,end,location,bodyPreview,webLink&$top=100&$orderby=start/dateTime`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'outlook.timezone="UTC"',
        },
      }
    );

    // Normalize Outlook events to match CRM activity shape
    return (response.data.value || []).map(event => ({
      id: `outlook_${event.id}`,
      outlook_id: event.id,
      title: event.subject || '(No Title)',
      description: event.bodyPreview || '',
      due_at: event.start?.dateTime ? new Date(event.start.dateTime).toISOString() : null,
      end_at: event.end?.dateTime ? new Date(event.end.dateTime).toISOString() : null,
      location: event.location?.displayName || '',
      web_link: event.webLink || '',
      source: 'outlook',
      activity_type: 'meeting',
    }));
  },

  /**
   * Create an event in Outlook Calendar (called when a CRM meeting/task is created).
   */
  async createCalendarEvent(user, activity) {
    const accessToken = await this.getValidAccessToken(user);

    const startTime = activity.due_at ? new Date(activity.due_at).toISOString() : new Date().toISOString();
    const endTime = new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString(); // +1 hour default

    const eventBody = {
      subject: activity.title,
      body: {
        contentType: 'text',
        content: activity.description || '',
      },
      start: {
        dateTime: startTime,
        timeZone: 'UTC',
      },
      end: {
        dateTime: endTime,
        timeZone: 'UTC',
      },
    };

    const response = await axios.post(
      `${GRAPH_API_BASE}/me/events`,
      eventBody,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.id; // Outlook event ID
  },

  /**
   * Delete an event from Outlook Calendar.
   */
  async deleteCalendarEvent(user, outlookEventId) {
    const accessToken = await this.getValidAccessToken(user);

    await axios.delete(
      `${GRAPH_API_BASE}/me/events/${outlookEventId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  },
};

module.exports = outlookCalendarService;
