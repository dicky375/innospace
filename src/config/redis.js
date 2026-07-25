import { Redis } from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

let client = null;
let isConnecting = false;

// ===== CACHE KEYS =====
export const KEYS = {
  affiliateBalance: (userId) => `affiliate:balance:${userId}`,
  leaderboard: () => 'affiliate:leaderboard',
  programs: () => 'programs:list',
  session: (token) => `session:${token}`,
  rateLimit: (ip) => `rate:limit:${ip}`,
  commissionRate: () => 'config:commission_rate',
};

// ===== REDIS CLIENT =====
export async function getRedisClient() {
  if (client) return client;

  if (isConnecting) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return client;
  }

  isConnecting = true;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('[Redis] REDIS_URL not defined, running without cache');
    isConnecting = false;
    return null;
  }

  const redisOptions = {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      console.log(`[Redis] Retry attempt ${times} in ${delay}ms`);
      return delay;
    },
    connectTimeout: 20000,
    lazyConnect: false,
  };

  try {
    client = new Redis(redisUrl, redisOptions);

    client.on('connect', () => {
      console.log('[Redis] ✓ Socket connected');
    });

    client.on('ready', () => {
      console.log('[Redis] ✓ Client ready and authenticated');
      isConnecting = false;
    });

    client.on('error', (err) => {
      console.error('[Redis] ✗ Error:', err.message);
      isConnecting = false;
    });

    client.on('close', () => {
      console.warn('[Redis] ! Connection closed');
      client = null;
    });

    // Verify connection
    await client.ping();
    console.log('[Redis] ✓ Connection verified');

  } catch (error) {
    console.error('[Redis] ✗ Initialization failed:', error);
    client = null;
    isConnecting = false;
    return null;
  }

  return client;
}

// ===== HELPER FUNCTIONS =====
export async function clearProgramsCache() {
  try {
    const redis = await getRedisClient();
    if (redis) {
      await redis.del(KEYS.programs());
      console.log('[Redis] 🗑️ Programs cache cleared');
    }
  } catch (err) {
    console.error('[Redis] Failed to clear cache:', err.message);
  }
}

export async function healthCheck() {
  try {
    const redis = await getRedisClient();
    if (redis) {
      await redis.ping();
      return { status: 'UP', latency: 'OK' };
    }
    return { status: 'DISABLED', message: 'Redis not configured' };
  } catch (err) {
    return { status: 'DOWN', error: err.message };
  }
}

export default { getRedisClient, clearProgramsCache, healthCheck, KEYS };