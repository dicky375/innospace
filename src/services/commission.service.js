import { getRedisClient, KEYS } from '../config/redis.js';

const DEFAULT_COMMISSION_RATE = 0.10;
const COMMISSION_RATE_KEY = 'config:commission_rate';

// ===== GET COMMISSION RATE =====
export async function getCommissionRate() {
  try {
    const redis = await getRedisClient();
    if (redis) {
      const stored = await redis.get(COMMISSION_RATE_KEY);
      return stored ? parseFloat(stored) : DEFAULT_COMMISSION_RATE;
    }
    return DEFAULT_COMMISSION_RATE;
  } catch (error) {
    console.warn('[Commission] Redis error, using default:', error.message);
    return DEFAULT_COMMISSION_RATE;
  }
}

// ===== SET COMMISSION RATE =====
export async function setCommissionRate(rate) {
  try {
    const redis = await getRedisClient();
    if (redis) {
      await redis.set(COMMISSION_RATE_KEY, rate.toString());
      console.log(`[Commission] Rate updated to ${rate * 100}%`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Commission] Failed to update rate:', error.message);
    return false;
  }
}

// ===== GET AFFILIATE BALANCE =====
export async function getAffiliateBalance(userId) {
  try {
    const redis = await getRedisClient();
    if (redis) {
      const balance = await redis.get(KEYS.affiliateBalance(userId));
      return balance ? parseFloat(balance) : 0;
    }
    return 0;
  } catch (error) {
    console.error('[Commission] Failed to get balance:', error.message);
    return 0;
  }
}

// ===== GET LEADERBOARD =====
export async function getLeaderboard(limit = 10) {
  try {
    const redis = await getRedisClient();
    if (redis) {
      const results = await redis.zrevrange(KEYS.leaderboard(), 0, limit - 1, 'WITHSCORES');
      const leaderboard = [];
      for (let i = 0; i < results.length; i += 2) {
        leaderboard.push({
          affiliateId: results[i],
          totalCommission: parseFloat(results[i + 1]).toFixed(2),
          rank: leaderboard.length + 1,
        });
      }
      return leaderboard;
    }
    return [];
  } catch (error) {
    console.error('[Commission] Failed to get leaderboard:', error.message);
    return [];
  }
}

export default {
  getCommissionRate,
  setCommissionRate,
  getAffiliateBalance,
  getLeaderboard
};