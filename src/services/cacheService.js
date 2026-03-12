import { redis } from "../config/redis.js";

export const getWalletCache = async (userId) => {
  return await redis.get(`wallet:${userId}`);
};

export const setWalletCache = async (userId, balance) => {
  await redis.set(`wallet:${userId}`, balance);
};

export const clearWalletCache = async (userId) => {
  await redis.del(`wallet:${userId}`);
};