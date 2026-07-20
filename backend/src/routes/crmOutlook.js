'use strict';

const express = require('express');
const router = express.Router();
const outlookCalendarService = require('../services/outlookCalendarService');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);


router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      connected: req.user.outlook_connected || false
    }
  });
});


router.get('/auth-url', (req, res) => {
  try {
    if (!outlookCalendarService.clientId || !outlookCalendarService.clientSecret || !outlookCalendarService.redirectUri) {
      return res.status(503).json({
        success: false,
        message: 'Outlook integration is not configured. Please set MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_REDIRECT_URI in your environment variables.'
      });
    }
    const url = outlookCalendarService.getAuthUrl(req.user.id);
    res.json({ success: true, url });
  } catch (error) {
    console.error('Error generating Outlook auth URL:', error);
    res.status(500).json({ success: false, message: 'Failed to generate Outlook login URL.' });
  }
});


router.delete('/disconnect', async (req, res) => {
  try {
    req.user.outlook_access_token = null;
    req.user.outlook_refresh_token = null;
    req.user.outlook_token_expiry = null;
    await req.user.save();
    
    res.json({ success: true, message: 'Outlook disconnected successfully.' });
  } catch (error) {
    console.error('Error disconnecting outlook:', error);
    res.status(500).json({ success: false, message: 'Failed to disconnect Outlook' });
  }
});


router.post('/sync', async (req, res) => {
  if (!req.user.outlook_connected) {
    return res.status(400).json({ success: false, message: 'Outlook is not connected' });
  }
  
  try {
    const start = req.body.start || new Date(new Date().getFullYear(), 0, 1).toISOString();
    const end = req.body.end || new Date(new Date().getFullYear(), 11, 31, 23, 59, 59).toISOString();
    
    const events = await outlookCalendarService.fetchOutlookEvents(req.user, start, end);
    res.json({ success: true, message: 'Sync complete', data: events });
  } catch (error) {
    console.error('Error syncing outlook events:', error);
    res.status(500).json({ success: false, message: 'Failed to sync Outlook events' });
  }
});

module.exports = router;
