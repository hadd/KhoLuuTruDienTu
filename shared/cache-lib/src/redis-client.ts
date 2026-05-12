import { BentoCache, bentostore } from "bentocache";
import { memoryDriver } from "bentocache/drivers/memory";
import { redisDriver, redisBusDriver } from "bentocache/drivers/redis";
import type { RedisOptions } from "ioredis";
import type {
  RedisCacheConfig,
  CacheClient,
  NamespaceConfig,
} from "./types.ts";
import { createNamespaceProxy } from "./namespace-proxy.ts";

/**
 * Create a Redis-backed cache client with multi-tier caching
 * 
 * This client uses a two-tier caching strategy:
 * - L1: Fast in-memory cache for the current instance
 * - L2: Shared Redis cache across all instances
 * - Bus: Redis pub/sub to sync L1 caches across instances
 * 
 * You must create and pass a static Redis client instance.
 * 
 * @param config - Redis cache configuration with static client
 * @returns Cache client with typed namespace access
 * 
 * @example
 * ```typescript
 * import { Redis } from 'ioredis';
 * 
 * // Create static Redis client first
 * const redisClient = new Redis({
 *   host: 'localhost',
 *   port: 6379
 * });
 * 
 * // Create cache with multi-tier setup
 * const cache = createRedisCacheLib({
 *   redis: redisClient,
 *   namespaces: {
 *     api: { ttl: '5m' },
 *     db: { ttl: '1h' },
 *     user: { ttl: '30m' }
 *   }
 * });
 * 
 * // Use typed namespace methods
 * await cache.db.set('posts:123', postData);
 * const post = await cache.db.get('posts:123');
 * await cache.user.clear();
 * ```
 */
export function createRedisCacheLib<T extends Record<string, NamespaceConfig>>(
  config: RedisCacheConfig & { namespaces: T },
): CacheClient<T> {
  const maxSize = config.maxSize ?? "50mb";

  // Initialize BentoCache with multi-tier setup:
  // L1 (memory) -> L2 (Redis) with Redis bus for synchronization
  const bento = new BentoCache({
    default: "redis-cache",
    stores: {
      "redis-cache": bentostore()
        .useL1Layer(memoryDriver({ maxSize }))
        .useL2Layer(
          redisDriver({
            connection: config.redis,
          }),
        )
        .useBus(
          redisBusDriver({
            connection: config.redis.duplicate() as unknown as RedisOptions,
          }),
        ),
    },
  });

  // Create base client object
  const client: any = {
    _bento: bento,
    _namespaces: config.namespaces,
  };

  // Add typed namespace proxies
  for (const [namespaceName, namespaceConfig] of Object.entries(
    config.namespaces,
  )) {
    client[namespaceName] = createNamespaceProxy(
      bento,
      namespaceName,
      namespaceConfig,
    );
  }

  return client as CacheClient<T>;
}
