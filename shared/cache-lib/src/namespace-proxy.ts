import type { BentoCache } from "bentocache";
import type {
  CacheNamespace,
  NamespaceConfig,
  CacheOptions,
  GetOrSetParams,
} from "./types.ts";

/**
 * Create a namespace proxy that provides typed methods for cache operations
 */
export function createNamespaceProxy(
  bento: BentoCache<any>,
  namespaceName: string,
  config: NamespaceConfig,
): CacheNamespace {
  const namespace = bento.namespace(namespaceName);

  return {
    async get<T = unknown>(key: string): Promise<T | null> {
      const fullKey = `${namespaceName}:${key}`;
      const result = await namespace.get<T>({ key: fullKey });
      return result ?? null;
    },

    async set<T = unknown>(
      key: string,
      value: T,
      options?: CacheOptions,
    ): Promise<void> {
      const fullKey = `${namespaceName}:${key}`;
      const ttl = options?.ttl ?? config.ttl;
      await namespace.set({ key: fullKey, value, ttl });
    },

    async getOrSet<T = unknown>(params: GetOrSetParams<T>): Promise<T> {
      const fullKey = `${namespaceName}:${params.key}`;
      const ttl = params.ttl ?? config.ttl;

      const result = await namespace.getOrSet<T>({
        key: fullKey,
        ttl,
        factory: params.factory,
      });

      return result;
    },

    async delete(key: string): Promise<void> {
      const fullKey = `${namespaceName}:${key}`;
      await namespace.delete({ key: fullKey });
    },

    async clear(): Promise<void> {
      await namespace.clear();
    },

    async has(key: string): Promise<boolean> {
      const fullKey = `${namespaceName}:${key}`;
      return await namespace.has({ key: fullKey });
    },
  };
}
