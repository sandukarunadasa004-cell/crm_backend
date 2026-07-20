'use strict';

const { User, CrmActivity } = require('../models');

// We use native fetch since Node 24 is being used
class OutlookCalendarService {
  constructor() {
    // You should put these in your .env
    this.clientId = process.env.MICROSOFT_CLIENT_ID || '0e564390-2007-400e-a2a5-363b19aa5b31';
    this.clientSecret = process.env.MICROSOFT_CLIENT_SECRET || ''; // Needs to be added to .env
    this.tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
    this.redirectUri = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:5000/api/public/outlook/callback';
    
    this.scopes = ['offline_access', 'Calendars.ReadWrite', 'User.Read'];
  }

  getAuthUrl(userId) {
    const url = new URL(`https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize`);
    url.searchParams.append('client_id', this.clientId);
    url.searchParams.append('response_type', 'code');
    url.searchParams.append('redirect_uri', this.redirectUri);
    url.searchParams.append('response_mode', 'query');
    url.searchParams.append('scope', this.scopes.join(' '));
    url.searchParams.append('state', userId); // Pass userId in state to know who is connecting
    return url.toString();
  }

  async exchangeCode(code, userId) {
    const params = new URLSearchParams();
    params.append('client_id', this.clientId);
    params.append('scope', this.scopes.join(' '));
    params.append('code', code);
    params.append('redirect_uri', this.redirectUri);
    params.append('grant_type', 'authorization_code');
    params.append('client_secret', this.clientSecret);

    const res = await fetch(`https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Failed to exchange code:', err);
      throw new Error('Failed to connect to Outlook');
    }

    const data = await res.json();
    
    const user = await User.findByPk(userId);
    if (user) {
      user.outlook_access_token = data.access_token;
      user.outlook_refresh_token = data.refresh_token;
      user.outlook_token_expiry = new Date(Date.now() + data.expires_in * 1000);
      await user.save();
    }
    
    return true;
  }

  async refreshAccessToken(user) {
    if (!user.outlook_refresh_token) {
      throw new Error('No refresh token available');
    }

    // If token is still valid for at least 5 minutes, no need to refresh
    if (user.outlook_token_expiry && user.outlook_token_expiry > new Date(Date.now() + 5 * 60000)) {
      return user.outlook_access_token;
    }

    const params = new URLSearchParams();
    params.append('client_id', this.clientId);
    params.append('scope', this.scopes.join(' '));
    params.append('refresh_token', user.outlook_refresh_token);
    params.append('grant_type', 'refresh_token');
    params.append('client_secret', this.clientSecret);

    const res = await fetch(`https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      // If refresh fails, disconnect the user
      user.outlook_access_token = null;
      user.outlook_refresh_token = null;
      user.outlook_token_expiry = null;
      await user.save();
      throw new Error('Failed to refresh Outlook token. Please reconnect.');
    }

    const data = await res.json();
    user.outlook_access_token = data.access_token;
    if (data.refresh_token) {
      user.outlook_refresh_token = data.refresh_token;
    }
    user.outlook_token_expiry = new Date(Date.now() + data.expires_in * 1000);
    await user.save();

    return user.outlook_access_token;
  }

  async pushEventToOutlook(user, activity) {
    if (!user.outlook_refresh_token) return null;
    
    try {
      const accessToken = await this.refreshAccessToken(user);
      const isUpdate = !!activity.outlook_event_id;
      
      const endpoint = isUpdate 
        ? `https://graph.microsoft.com/v1.0/me/events/${activity.outlook_event_id}`
        : 'https://graph.microsoft.com/v1.0/me/events';
        
      const method = isUpdate ? 'PATCH' : 'POST';

      const eventPayload = {
        subject: `[CRM] ${activity.title}`,
        body: {
          contentType: 'Text',
          content: activity.description || '',
        },
        start: {
          dateTime: activity.due_at ? new Date(activity.due_at).toISOString() : new Date().toISOString(),
          timeZone: 'UTC'
        },
        end: {
          // Outlook needs an end time. Defaulting to 1 hour after start
          dateTime: activity.due_at 
            ? new Date(new Date(activity.due_at).getTime() + 60*60*1000).toISOString() 
            : new Date(Date.now() + 60*60*1000).toISOString(),
          timeZone: 'UTC'
        }
      };

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventPayload)
      });

      if (!res.ok) {
        console.error('Failed to sync to outlook', await res.text());
        return null;
      }

      const data = await res.json();
      
      if (!isUpdate && data.id) {
        activity.outlook_event_id = data.id;
        await activity.save();
      }
      
      return data;
    } catch (e) {
      console.error('Outlook push error:', e);
      return null;
    }
  }

  async deleteEventFromOutlook(user, outlookEventId) {
    if (!user.outlook_refresh_token || !outlookEventId) return;
    
    try {
      const accessToken = await this.refreshAccessToken(user);
      await fetch(`https://graph.microsoft.com/v1.0/me/events/${outlookEventId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
    } catch (e) {
      console.error('Outlook delete error:', e);
    }
  }

  async fetchOutlookEvents(user, start, end) {
    if (!user.outlook_refresh_token) return [];
    
    try {
      const accessToken = await this.refreshAccessToken(user);
      
      const query = new URLSearchParams({
        startDateTime: start,
        endDateTime: end,
        $select: 'id,subject,bodyPreview,start,end'
      });
      
      const res = await fetch(`https://graph.microsoft.com/v1.0/me/calendarView?${query.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Prefer': 'outlook.timezone="UTC"'
        }
      });
      
      if (!res.ok) return [];
      
      const data = await res.json();
      
      // Transform to match CRM activity structure for the frontend
      return (data.value || []).map(event => ({
        id: `outlook_${event.id}`, // pseudo id
        outlook_event_id: event.id,
        title: event.subject,
        description: event.bodyPreview,
        activity_type: 'outlook', // special type for UI rendering
        due_at: event.start?.dateTime,
        isOutlook: true
      }));
    } catch (e) {
      console.error('Outlook fetch error:', e);
      return [];
    }
  }
}

module.exports = new OutlookCalendarService();
