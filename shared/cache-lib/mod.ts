/**
 * Cache Library - @shared/cache-lib
 * 
 * A lean cache library with namespace-based configuration, Redis support, and typed bindings.
 * 
 * Quick Start:
 * ```typescript
 * import { cache } from "@shared/cache-lib";
 * await cache.api.set('users:list', data);
 * const users = await cache.api.get('users:list');
 * ```
 */

// Default pre-configured cache (ready to use)
export { cache } from "./src/default-cache.ts";

// Client factories
export { createMemoryCacheLib } from "./src/memory-client.ts";
export { createRedisCacheLib } from "./src/redis-client.ts";

// JWT helper functions
export {
  decodeJWT,
  getJWTExpiration,
  calculateJWTTTL,
  cacheWithJWT,
  type JWTPayload,
} from "./src/jwt-helper.ts";

// Types
export type {
  NamespaceConfig,
  MemoryCacheConfig,
  RedisCacheConfig,
  CacheOptions,
  CacheFactoryContext,
  GetOrSetParams,
  CacheNamespace,
  BaseCacheClient,
  CacheClient,
} from "./src/types.ts";
