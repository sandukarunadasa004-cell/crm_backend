'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config/app');
const { CrmShopProfile, CrmTicket } = require('../models');

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // Allow public websites to connect
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  io.use(async (socket, next) => {
    // 1. Try JWT Auth (CRM Agent)
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwt.accessSecret);
        socket.isAgent = true;
        socket.userId = decoded.userId;
        socket.tenantId = decoded.tenantId;
        return next();
      } catch (err) {
        return next(new Error('Invalid token'));
      }
    }

    // 2. Try Public Auth (Customer Widget)
    const apiKey = socket.handshake.auth?.apiKey || socket.handshake.query?.apiKey;
    const ticketNo = socket.handshake.auth?.ticketNo || socket.handshake.query?.ticketNo;
    
    if (apiKey && ticketNo) {
      try {
        const shopProfile = await CrmShopProfile.findOne({ where: { public_api_key: apiKey } });
        if (!shopProfile) return next(new Error('Invalid API key'));

        const ticket = await CrmTicket.findOne({ where: { ticket_no: ticketNo, tenant_id: shopProfile.tenant_id } });
        if (!ticket) return next(new Error('Invalid ticket'));

        socket.isCustomer = true;
        socket.tenantId = shopProfile.tenant_id;
        socket.ticketId = ticket.id;
        socket.ticketNo = ticket.ticket_no;
        return next();
      } catch (err) {
        return next(new Error('Database error during auth'));
      }
    }

    return next(new Error('Authentication required'));
  });

  io.on('connection', (socket) => {
    if (socket.isAgent) {
      console.log(`Socket connected (Agent): user=${socket.userId}, tenant=${socket.tenantId}`);
      socket.join(`tenant:${socket.tenantId}`);
      socket.join(`user:${socket.userId}`);
    } else if (socket.isCustomer) {
      console.log(`Socket connected (Customer): ticket=${socket.ticketNo}, tenant=${socket.tenantId}`);
      // Only join the specific ticket room to prevent seeing other tickets
      socket.join(`ticket:${socket.ticketId}`);
    }

    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${socket.isAgent ? 'Agent' : 'Customer'}, reason=${reason}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initSocket first.');
  }
  return io;
};

const emitToUser = (userId, event, data) => {
  if (io) io.to(`user:${userId}`).emit(event, data);
};

const emitToTenant = (tenantId, event, data) => {
  if (io) io.to(`tenant:${tenantId}`).emit(event, data);
};

const emitToTicket = (ticketId, event, data) => {
  if (io) io.to(`ticket:${ticketId}`).emit(event, data);
};

module.exports = { initSocket, getIO, emitToUser, emitToTenant, emitToTicket };
