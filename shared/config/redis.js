import { Redis } from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

let client = null;

export async function getRedisClient() {
  if (client) return client;

  client = new Redis(process.env.REDIS_URL, {
    tls: {},  // required for Redis Cloud
    maxRetriesPerRequest: 3,
  });

  client.on('connect', () => console.log('[Redis] ✓ Connected'));
  client.on('error', (err) => console.error('[Redis] Error:', err.message));

  return client;
}

export const KEYS = {
  internBalance: (userId) => `intern:balance:${userId}`,
  leaderboard: () => 'intern:leaderboard',
  programs: () => 'programs:list',
  session: (token) => `session:${token}`,
};