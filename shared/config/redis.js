require('dotenv').config();
const { createClient } = require('redis');

let client = null;

async function getRedisClient() {
  if (client && client.isOpen) return client;
  client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  client.on('error', (err) => console.error('[Redis] Error:', err.message));
  client.on('connect', () => console.log('[Redis] ✓ Connected'));
  await client.connect();
  return client;
}

const KEYS = {
  internBalance: (userId) => `intern:balance:${userId}`,
  leaderboard: () => 'intern:leaderboard',
  programs: () => 'programs:list',
  session: (token) => `session:${token}`,
};

module.exports = { getRedisClient, KEYS };