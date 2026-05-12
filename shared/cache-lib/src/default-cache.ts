import { Redis } from "ioredis";
import { createMemoryCacheLib } from "./memory-client.ts";
import { createRedisCacheLib } from "./redis-client.ts";
import type { CacheClient } from "./types.ts";

const namespaceConfig = {
  api: { ttl: "5m" },
  db: { ttl: "1h" },
  user: { ttl: "30m" },
  temp: { ttl: "5m" },
} as const;

export async function initializeCache(
  redisUri?: string,
): Promise<CacheClient<typeof namespaceConfig>> {
  if (redisUri) {
    try {
      const redisClient = new Redis(redisUri, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) return null;
          return Math.min(times * 50, 2000);
        },
        enableReadyCheck: true,
        lazyConnect: true,
      });

      redisClient.on("error", (err) => {
        console.warn("Redis cache connection error (falling back to memory):", err.message);
      });

      redisClient.on("connect", () => {
        console.info("Redis cache connected successfully");
      });

      await redisClient.connect().catch(() => {
        console.warn("Redis cache unavailable at startup, using memory cache");
      });

      if (redisClient.status !== "ready") {
        await Promise.race([
          new Promise<void>((resolve) => redisClient.once("ready", resolve)),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error("ready timeout")), 1500)
          ),
        ]).catch(() => {});
      }

      if (redisClient.status === "ready") {
        const client = createRedisCacheLib({
          redis: redisClient,
          namespaces: namespaceConfig,
          maxSize: "50mb",
        });
        (client as { _defaultCacheBackend?: string })._defaultCacheBackend = "redis";
        return client;
      } else {
        console.warn("Redis cache unavailable at startup, using memory cache");
        const client = createMemoryCacheLib({
          namespaces: namespaceConfig,
          maxSize: "50mb",
        });
        (client as { _defaultCacheBackend?: string })._defaultCacheBackend = "memory";
        return client;
      }
    } catch (error) {
      console.warn("Failed to initialize Redis cache, using memory cache:", error);
      const client = createMemoryCacheLib({
        namespaces: namespaceConfig,
        maxSize: "50mb",
      });
      (client as { _defaultCacheBackend?: string })._defaultCacheBackend = "memory";
      return client;
    }
  } else {
    const client = createMemoryCacheLib({
      namespaces: namespaceConfig,
      maxSize: "50mb",
    });
    (client as { _defaultCacheBackend?: string })._defaultCacheBackend = "memory";
    return client;
  }
}

const cache = await initializeCache(Deno.env.get("REDIS_CACHE_URI"));
export { cache };

