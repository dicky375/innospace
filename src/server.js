import dotenv from 'dotenv';
dotenv.config();

// ✅ ADD THIS DEBUGGING AT THE VERY TOP
console.log('========================================');
console.log('🚀 SERVER STARTING...');
console.log(`📋 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`📋 PORT from env: ${process.env.PORT || 'not set'}`);
console.log('========================================');

import express from 'express';
// ... rest of your imports

const PORT = process.env.PORT || 3000;
console.log(`📋 PORT will be: ${PORT}`); // ✅ Add this

// ... rest of your code

// ===== START SERVER =====
async function startServer() {
  try {
    console.log('🔄 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected');

    console.log('🔄 Syncing database schema...');
    await sequelize.sync({ alter: true });
    console.log('✅ Database schema synced');

    console.log('🔄 Connecting to Redis...');
    try {
      await getRedisClient();
      console.log('✅ Redis connected');
    } catch (err) {
      console.warn('⚠️ Redis not available:', err.message);
    }

    // ✅ START SERVER WITH EXPLICIT BINDING
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 INNOSPACE MONOLITH`);
      console.log(`=================================`);
      console.log(`📍 URL: http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'production'}`);
      console.log(`📊 Port: ${PORT}`);
      console.log(`=================================\n`);
    });

    // ✅ Add error handler for the server
    server.on('error', (err) => {
      console.error('❌ Server error:', err);
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use!`);
      }
    });

    // ✅ Log when server is actually listening
    server.on('listening', () => {
      console.log(`✅ Server is listening on port ${PORT}`);
    });

  } catch (error) {
    console.error('❌ Startup failed:', error);
    console.error('❌ Stack:', error.stack);
    process.exit(1);
  }
}

startServer();

export default app;