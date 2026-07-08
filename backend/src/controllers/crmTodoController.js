'use strict';

const crmTodoService = require('../services/crmTodoService');
const { sendSuccess, sendError } = require('../utils/response');
const { logAudit, getAuditContext } = require('../utils/auditLogger');

const crmTodoController = {
  async getTodos(req, res) {
    try {
      const { filter } = req.query;
      const todos = await crmTodoService.getTodos({
        tenantId: req.tenantId,
        userId: req.user.id,
        filter
      });
      return sendSuccess(res, todos, 'Todos retrieved successfully.');
    } catch (error) {
      console.error('Error fetching todos:', error);
      return sendError(res, error.message || 'Failed to fetch todos.', 500);
    }
  },

  async createTodo(req, res) {
    try {
      const todo = await crmTodoService.createTodo({
        tenantId: req.tenantId,
        userId: req.user.id,
        data: req.body
      });

      await logAudit({
        ...getAuditContext(req),
        action: 'create',
        entityType: 'todo',
        entityId: todo.id,
        description: `Created todo: ${todo.title}`
      });

      return sendSuccess(res, todo, 'Todo created successfully.', 201);
    } catch (error) {
      console.error('Error creating todo:', error);
      const statusCode = error.message.includes('required') ? 400 : 500;
      return sendError(res, error.message || 'Failed to create todo.', statusCode);
    }
  },

  async updateTodo(req, res) {
    try {
      const todo = await crmTodoService.updateTodo({
        id: req.params.id,
        tenantId: req.tenantId,
        userId: req.user.id,
        data: req.body
      });

      await logAudit({
        ...getAuditContext(req),
        action: 'update',
        entityType: 'todo',
        entityId: todo.id,
        description: `Updated todo: ${todo.title}`
      });

      return sendSuccess(res, todo, 'Todo updated successfully.');
    } catch (error) {
      console.error('Error updating todo:', error);
      const statusCode = error.message.includes('not found') ? 404 : error.message.includes('creator') ? 403 : 500;
      return sendError(res, error.message || 'Failed to update todo.', statusCode);
    }
  },

  async deleteTodo(req, res) {
    try {
      await crmTodoService.deleteTodo({
        id: req.params.id,
        tenantId: req.tenantId,
        userId: req.user.id
      });

      await logAudit({
        ...getAuditContext(req),
        action: 'delete',
        entityType: 'todo',
        entityId: req.params.id,
        description: `Deleted todo`
      });

      return sendSuccess(res, null, 'Todo deleted successfully.');
    } catch (error) {
      console.error('Error deleting todo:', error);
      const statusCode = error.message.includes('not found') ? 404 : error.message.includes('creator') ? 403 : 500;
      return sendError(res, error.message || 'Failed to delete todo.', statusCode);
    }
  }
};

module.exports = crmTodoController;
