import type { BentoCache } from "bentocache";
import type { Redis } from "ioredis";

/** Namespace configuration with TTL settings */
export interface NamespaceConfig {
  ttl: string;
}

/** In-memory cache configuration */
export interface MemoryCacheConfig {
  namespaces: Record<string, NamespaceConfig>;
  maxSize?: string;
}

/** Redis-backed cache configuration */
export interface RedisCacheConfig {
  redis: Redis;
  namespaces: Record<string, NamespaceConfig>;
  maxSize?: string;
}

/** Cache operation options */
export interface CacheOptions {
  ttl?: string;
}

/** Factory context for getOrSet operations */
export interface CacheFactoryContext {
  setOptions(options: CacheOptions): void;
}

/** Parameters for getOrSet operation */
export interface GetOrSetParams<T> {
  key: string;
  factory: (ctx: CacheFactoryContext) => Promise<T> | T;
  ttl?: string;
}

/** Cache namespace interface with typed methods */
export interface CacheNamespace {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, options?: CacheOptions): Promise<void>;
  getOrSet<T = unknown>(params: GetOrSetParams<T>): Promise<T>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

/** Base cache client interface */
export interface BaseCacheClient {
  _bento: BentoCache<any>;
  _namespaces: Record<string, NamespaceConfig>;
}

/** Cache client with typed namespace access */
export type CacheClient<T extends Record<string, NamespaceConfig>> = BaseCacheClient & {
  [K in keyof T]: CacheNamespace;
};

