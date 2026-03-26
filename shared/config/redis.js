import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

let client = null;

/**
 * Initializes and returns a singleton Redis client.
 * Automatically detects if TLS is required based on the URL protocol.
 */
export async function getRedisClient() {
  if (client) return client;

  const redisUrl = process.env.REDIS_URL;

  console.log('[Redis] Attempting connection to:', redisUrl?.split('@')[1]); // Log host only for safety
  console.log('[Redis] Protocol detected:', redisUrl?.split(':')[0]);

  // Configuration options for ioredis
  const redisOptions = {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      // Exponential backoff with a cap at 2 seconds
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    // Dynamically enable TLS if the URL starts with 'rediss://'
    ...(redisUrl.startsWith('rediss://') && {
      tls: {
        rejectUnauthorized: false, // Useful for managed services like Redis Cloud
      },
    }),
  };

  try {
    client = new Redis(redisUrl, redisOptions);

    // Event Handlers
    client.on('connect', () => {
      console.log('[Redis] ✓ Connection established');
    });

    client.on('ready', () => {
      console.log('[Redis] ✓ Client ready to receive commands');
    });

    client.on('error', (err) => {
      // The error you saw: "packet length too long" usually 
      // stems from a protocol mismatch (TLS vs Plaintext)
      console.error('[Redis] ✗ Error:', err.message);
    });

    client.on('close', () => {
      console.warn('[Redis] ! Connection closed');
    });

  } catch (error) {
    console.error('[Redis] ✗ Failed to initialize client:', error);
    throw error;
  }

  return client;
}

/**
 * Cache Key Generators
 */
export const KEYS = {
  internBalance: (userId) => `intern:balance:${userId}`,
  leaderboard: () => 'intern:leaderboard',
  programs: () => 'programs:list',
  session: (token) => `session:${token}`,
};