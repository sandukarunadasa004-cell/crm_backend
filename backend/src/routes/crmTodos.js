'use strict';

const express = require('express');
const router = express.Router();
const crmTodoController = require('../controllers/crmTodoController');
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/tenantScope');

router.use(authenticate);
router.use(tenantScope);

router.get('/', crmTodoController.getTodos);
router.post('/', crmTodoController.createTodo);
router.put('/:id', crmTodoController.updateTodo);
router.delete('/:id', crmTodoController.deleteTodo);

module.exports = router;
