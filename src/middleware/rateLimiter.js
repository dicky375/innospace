import rateLimit from 'express-rate-limit';
import { getRedisClient } from '../config/redis.js';

// Memory store fallback if Redis is not available
class MemoryStore {
  constructor() {
    this.store = new Map();
  }

  async increment(key) {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    
    if (!this.store.has(key)) {
      const resetTime = now + windowMs;
      this.store.set(key, { count: 1, resetTime });
      return { count: 1, resetTime };
    }

    const data = this.store.get(key);
    if (now > data.resetTime) {
      const resetTime = now + windowMs;
      this.store.set(key, { count: 1, resetTime });
      return { count: 1, resetTime };
    }

    data.count++;
    this.store.set(key, data);
    return { count: data.count, resetTime: data.resetTime };
  }

  async decrement(key) {
    // Not needed for rate limiting
  }

  async resetKey(key) {
    this.store.delete(key);
  }
}

// Redis store for rate limiting
class RedisStore {
  constructor() {
    this.client = null;
    this.initialized = false;
    this.memoryStore = null;
  }

  async init() {
    if (!this.initialized) {
      try {
        this.client = await getRedisClient();
        this.initialized = true;
        if (this.client) {
          console.log('[RateLimit] Using Redis store');
        } else {
          console.warn('[RateLimit] Redis unavailable, falling back to memory store');
          this.memoryStore = new MemoryStore();
        }
      } catch (err) {
        console.warn('[RateLimit] Redis error, falling back to memory store:', err.message);
        this.initialized = true;
        this.client = null;
        this.memoryStore = new MemoryStore();
      }
    }
  }

  async increment(key) {
    await this.init();
    
    // If no Redis client, use memory store
    if (!this.client) {
      return this.memoryStore.increment(key);
    }

    try {
      const windowMs = 60 * 1000;
      const now = Date.now();
      const resetTime = Math.ceil((now + windowMs) / 1000);

      const multi = this.client.multi();
      multi.incr(key);
      multi.expireat(key, resetTime);
      
      const results = await multi.exec();
      const count = results[0][1];
      
      return { count, resetTime: resetTime * 1000 };
    } catch (err) {
      console.warn('[RateLimit] Redis operation failed, using memory store:', err.message);
      return this.memoryStore.increment(key);
    }
  }

  async decrement(key) {
    // Not needed
  }

  async resetKey(key) {
    if (this.client) {
      try {
        await this.client.del(key);
      } catch (err) {
        console.warn('[RateLimit] Redis delete failed:', err.message);
      }
    } else if (this.memoryStore) {
      await this.memoryStore.resetKey(key);
    }
  }
}

// Create rate limiter
const store = new RedisStore();

export const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  store: store,
  skip: (req) => {
    // Skip rate limiting for webhooks and health checks
    return req.path === '/api/webhook/paystack' || req.path === '/health';
  },
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?.id || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests, please try again later.',
      retryAfter: Math.ceil(60 / 1000)
    });
  }
});

export default { rateLimiter };