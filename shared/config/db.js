const mongoose = require('mongoose');

function createConnection(uri, label) {
  const conn = mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  conn.on('connected', () => console.log(`[MongoDB] ✓ ${label} connected`));
  conn.on('error', (err) => console.error(`[MongoDB] ✗ ${label}:`, err.message));
  conn.on('disconnected', () => console.warn(`[MongoDB] ⚠ ${label} disconnected`));

  process.on('SIGINT', async () => { await conn.close(); });

  return conn;
}

module.exports = { createConnection };