'use strict';

const express = require('express');
const router = express.Router();
const publicTicketController = require('../controllers/publicTicketController');

const submissionTracker = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 15 * 60 * 1000;

function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const record = submissionTracker.get(ip);

  if (record) {
    if (now - record.windowStart < RATE_WINDOW_MS) {
      if (record.count >= RATE_LIMIT) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests. Please wait before submitting again.',
        });
      }
      record.count++;
    } else {
      
      submissionTracker.set(ip, { windowStart: now, count: 1 });
    }
  } else {
    submissionTracker.set(ip, { windowStart: now, count: 1 });
  }

  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of submissionTracker.entries()) {
    if (now - record.windowStart > RATE_WINDOW_MS) {
      submissionTracker.delete(ip);
    }
  }
}, 30 * 60 * 1000);

router.post('/tickets', rateLimiter, publicTicketController.submitTicket);
router.get('/tickets/:ticket_no', publicTicketController.getTicket);
router.post('/tickets/:ticket_no/messages', rateLimiter, publicTicketController.addMessage);

module.exports = router;
