import { REDIS_CACHE_URI } from "@shared/test-vars";
import { assertEquals, assertExists } from "@std/assert";
import { Redis } from "ioredis";
import { createRedisCacheLib } from "../src/redis-client.ts";

function createTestRedisClient(): Redis | null {
  if (!REDIS_CACHE_URI) {
    return null;
  }

  try {
    const client = new Redis(REDIS_CACHE_URI, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    return client;
  } catch {
    return null;
  }
}

async function checkRedisAvailable(client: Redis): Promise<boolean> {
  try {
    await client.connect();
    await client.ping();
    return true;
  } catch {
    return false;
  } finally {
    try {
      await client.quit();
    } catch {
      // Ignore quit errors
    }
  }
}

const TEST_OPTS = {
  sanitizeOps: false,
  sanitizeResources: false,
} as const;
Deno.test({
  name: "Redis Client - Create with namespaces",
  ...TEST_OPTS,
  fn: async () => {
  const redisClient = createTestRedisClient();
  if (!redisClient) {
    return;
  }

  const available = await checkRedisAvailable(redisClient);
  if (!available) {
    return;
  }

  const client = new Redis(REDIS_CACHE_URI, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  await client.connect();

  try {
    const cache = createRedisCacheLib({
      redis: client,
      namespaces: {
        api: { ttl: "5m" },
        db: { ttl: "1h" },
      },
    });

    assertExists(cache.api);
    assertExists(cache.db);
    assertEquals(cache._namespaces.api.ttl, "5m");
    assertEquals(cache._namespaces.db.ttl, "1h");
  } finally {
    await client.quit();
  }
}});

Deno.test({
  name: "Redis Client - Set and get operations",
  ...TEST_OPTS,
  fn: async () => {
  const redisClient = createTestRedisClient();
  if (!redisClient) {
    return;
  }

  const available = await checkRedisAvailable(redisClient);
  if (!available) {
    return;
  }

  const client = new Redis(REDIS_CACHE_URI, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  await client.connect();

  try {
    const cache = createRedisCacheLib({
      redis: client,
      namespaces: {
        api: { ttl: "5m" },
      },
    });

    await cache.api.set("test:key", { id: 1, name: "test" });
    const result = await cache.api.get<{ id: number; name: string }>("test:key");

    assertEquals(result?.id, 1);
    assertEquals(result?.name, "test");

    await cache.api.delete("test:key");
  } finally {
    await client.quit();
  }
}});

Deno.test({
  name: "Redis Client - GetOrSet with factory",
  ...TEST_OPTS,
  fn: async () => {
  const redisClient = createTestRedisClient();
  if (!redisClient) {
    return;
  }

  const available = await checkRedisAvailable(redisClient);
  if (!available) {
    return;
  }

  const client = new Redis(REDIS_CACHE_URI, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  await client.connect();

  try {
    const cache = createRedisCacheLib({
      redis: client,
      namespaces: {
        api: { ttl: "5m" },
      },
    });

    let factoryCallCount = 0;
    const factory = async () => {
      factoryCallCount++;
      return { data: "factory-result" };
    };

    const result1 = await cache.api.getOrSet({
      key: "factory:test",
      factory,
    });

    const result2 = await cache.api.getOrSet({
      key: "factory:test",
      factory,
    });

    assertEquals(result1.data, "factory-result");
    assertEquals(result2.data, "factory-result");
    assertEquals(factoryCallCount, 1);

    await cache.api.delete("factory:test");
  } finally {
    await client.quit();
  }
}});

Deno.test({
  name: "Redis Client - Namespace isolation",
  ...TEST_OPTS,
  fn: async () => {
  const redisClient = createTestRedisClient();
  if (!redisClient) {
    return;
  }

  const available = await checkRedisAvailable(redisClient);
  if (!available) {
    return;
  }

  const client = new Redis(REDIS_CACHE_URI, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  await client.connect();

  try {
    const cache = createRedisCacheLib({
      redis: client,
      namespaces: {
        api: { ttl: "5m" },
        db: { ttl: "5m" },
      },
    });

    await cache.api.set("shared:key", { namespace: "api" });
    await cache.db.set("shared:key", { namespace: "db" });

    const apiResult = await cache.api.get<{ namespace: string }>("shared:key");
    const dbResult = await cache.db.get<{ namespace: string }>("shared:key");

    assertEquals(apiResult?.namespace, "api");
    assertEquals(dbResult?.namespace, "db");

    await cache.api.delete("shared:key");
    await cache.db.delete("shared:key");
  } finally {
    await client.quit();
  }
}});

