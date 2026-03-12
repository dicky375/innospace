import Redis from "ioredis";

export const redis = new Redis(process.env.REDIS_URL);

redis.on("connect", () => {
  console.log("Redis cache connected");
});