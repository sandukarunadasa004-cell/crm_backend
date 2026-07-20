'use strict';

const express = require('express');
const router = express.Router();
const publicSupportController = require('../controllers/publicSupportController');




router.post('/tickets', publicSupportController.createTicket);


router.get('/tickets/:ticket_no', publicSupportController.getTicket);


router.post('/tickets/:ticket_no/messages', publicSupportController.addMessage);

module.exports = router;
