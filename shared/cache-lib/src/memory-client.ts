import { BentoCache, bentostore } from "bentocache";
import { memoryDriver } from "bentocache/drivers/memory";
import type {
  MemoryCacheConfig,
  CacheClient,
  NamespaceConfig,
} from "./types.ts";
import { createNamespaceProxy } from "./namespace-proxy.ts";

/**
 * Create an in-memory cache client (no Redis required)
 * 
 * This is the simplest cache client that only uses memory for caching.
 * Perfect for single-instance applications or development environments.
 * 
 * @param config - Memory cache configuration with namespaces
 * @returns Cache client with typed namespace access
 * 
 * @example
 * ```typescript
 * const cache = createMemoryCacheLib({
 *   namespaces: {
 *     api: { ttl: '5m' },
 *     temp: { ttl: '2m' }
 *   }
 * });
 * 
 * // Use typed namespace methods
 * await cache.api.set('users:list', userData);
 * const data = await cache.api.get('users:list');
 * await cache.temp.clear();
 * ```
 */
export function createMemoryCacheLib<T extends Record<string, NamespaceConfig>>(
  config: MemoryCacheConfig & { namespaces: T },
): CacheClient<T> {
  const maxSize = config.maxSize ?? "50mb";

  // Initialize BentoCache with memory driver only
  const bento = new BentoCache({
    default: "memory",
    stores: {
      memory: bentostore().useL1Layer(memoryDriver({ maxSize })),
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

