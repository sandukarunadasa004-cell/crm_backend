'use strict';

const { CrmTodo, User } = require('../models');

const crmTodoService = {
  async getTodos({ tenantId, userId, filter }) {
    let where = { tenant_id: tenantId };
    
    if (filter === 'public') {
      where.is_public = true;
    } else {
      where.user_id = userId;
    }

    const todos = await CrmTodo.findAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'first_name', 'last_name'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    return todos.map(todo => ({
      ...todo.toJSON(),
      owner_name: todo.user ? `${todo.user.first_name} ${todo.user.last_name}`.trim() : 'Unknown'
    }));
  },

  async createTodo({ tenantId, userId, data }) {
    const { title, description, is_public } = data;
    
    if (!title) {
      throw new Error('Title is required.');
    }

    const todo = await CrmTodo.create({
      tenant_id: tenantId,
      user_id: userId,
      title,
      description,
      is_public: is_public || false,
    });
    
    return todo;
  },

  async updateTodo({ id, tenantId, userId, data }) {
    const todo = await CrmTodo.findOne({ where: { id, tenant_id: tenantId } });
    if (!todo) throw new Error('Todo not found.');
    
    if (todo.user_id !== userId) {
      throw new Error('Only the creator can update this Todo.');
    }

    const { title, description, is_public, completed_at } = data;
    if (title !== undefined) todo.title = title;
    if (description !== undefined) todo.description = description;
    if (is_public !== undefined) todo.is_public = is_public;
    if (completed_at !== undefined) todo.completed_at = completed_at;

    await todo.save();
    return todo;
  },

  async deleteTodo({ id, tenantId, userId }) {
    const todo = await CrmTodo.findOne({ where: { id, tenant_id: tenantId } });
    if (!todo) throw new Error('Todo not found.');

    if (todo.user_id !== userId) {
      throw new Error('Only the creator can delete this Todo.');
    }

    await todo.destroy();
    return true;
  }
};

module.exports = crmTodoService;
