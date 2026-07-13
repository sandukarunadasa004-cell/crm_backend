'use strict';

require('dotenv').config();

const http = require('http');
const app = require('./app');
const config = require('./config/app');
const { sequelize, CrmTodo, CrmLeadAssignee } = require('./models');
const { initSocket } = require('./socket');
const slaWatcher = require('./workers/slaWatcher');

const PORT = config.app.port;


const server = http.createServer(app);


initSocket(server);



const startServer = async () => {
  try {
    
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    // Auto-create crm_todos table if it doesn't exist
    await CrmTodo.sync({ alter: true });
    console.log('✅ Checked/Synchronized crm_todos table schema.');

    // Auto-create crm_lead_assignees junction table
    await CrmLeadAssignee.sync({ alter: true });
    console.log('✅ Checked/Synchronized crm_lead_assignees table schema.');

    
    
    console.log('✅ Connected to POS Database (Schema untouched by CRM).');

    
    server.listen(PORT, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════════╗');
      console.log('║         BILLIFY CRM SERVER STARTED           ║');
      console.log('╠══════════════════════════════════════════════╣');
      console.log(`║  Environment : ${config.app.env.padEnd(29)}║`);
      console.log(`║  Port        : ${String(PORT).padEnd(29)}║`);
      console.log(`║  API URL     : ${config.app.url.padEnd(29)}║`);
      console.log(`║  Frontend    : ${config.app.frontendUrl.padEnd(29)}║`);
      console.log('╚══════════════════════════════════════════════╝');
      console.log('');

      
      slaWatcher.start();
    });
  } catch (error) {
    console.error('❌ Unable to start server:', error.message);
    console.error('   Check your database connection settings in .env');
    process.exit(1);
  }
};


process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  slaWatcher.stop();
  server.close(async () => {
    await sequelize.close();
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  slaWatcher.stop();
  server.close(async () => {
    await sequelize.close();
    console.log('Server closed.');
    process.exit(0);
  });
});


process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();
