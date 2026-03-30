import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

let client = null;

/**
 * Initializes and returns a singleton Redis client.
 * Note: TLS is disabled here to match the 'redis://' protocol.
 */
export async function getRedisClient() {
  if (client) return client;

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error('[Redis] REDIS_URL is not defined in .env');
  }

  // We remove the 'tls' object entirely. 
  // If 'tls' is present (even if empty), ioredis will attempt an SSL handshake.
  const redisOptions = {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    // Explicitly ensure connectTimeout is sufficient for cloud connections
    connectTimeout: 10000, 
  };

  try {
    // Create the client
    client = new Redis(redisUrl, redisOptions);

    // Connection Event Handlers
    client.on('connect', () => {
      console.log('[Redis] ✓ Socket connected');
    });

    client.on('ready', () => {
      console.log('[Redis] ✓ Client ready and authenticated');
    });

    client.on('error', (err) => {
      // If you still see "packet length too long", double check your .env 
      // is not being cached with an old 'rediss://' value.
      console.error('[Redis] ✗ Error:', err.message);
    });

    client.on('close', () => {
      console.warn('[Redis] ! Connection closed');
    });

  } catch (error) {
    console.error('[Redis] ✗ Initialization failed:', error);
    throw error;
  }

  return client;
}

export async function clearProgramsCache() {
  const redis = await getRedisClient();
  await redis.del(KEYS.programs());
  console.log('[Redis] 🗑️ Programs cache cleared');
}
/**
 * Standard Cache Keys
 */
export const KEYS = {
  internBalance: (userId) => `intern:balance:${userId}`,
  leaderboard: () => 'intern:leaderboard',
  programs: () => 'programs:list',
  session: (token) => `session:${token}`,
};
