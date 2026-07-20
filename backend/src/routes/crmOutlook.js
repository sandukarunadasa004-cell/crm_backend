'use strict';

const express = require('express');
const router = express.Router();
const outlookCalendarService = require('../services/outlookCalendarService');

// Get Outlook connection status
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      connected: req.user.outlook_connected || false
    }
  });
});

// Get URL to redirect user to Microsoft Login
router.get('/auth-url', (req, res) => {
  const url = outlookCalendarService.getAuthUrl(req.user.id);
  res.json({ success: true, url });
});

// Disconnect Outlook
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

// Sync (pull) Outlook events (Optional manual trigger, mostly handled in calendar read)
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
