import { assertEquals, assertExists } from "@std/assert";
import { createTestCache } from "./setup/helpers.ts";

const TEST_OPTS = {
    sanitizeOps: false,
    sanitizeResources: false,
} as const;

Deno.test({
  name: "Memory Cache - Create with namespaces",
  ...TEST_OPTS,
  fn: async () => {
  const cache = createTestCache({
    api: { ttl: "5m" },
    temp: { ttl: "1s" },
  });

  assertExists(cache.api);
  assertExists(cache.temp);
  assertEquals(cache._namespaces.api.ttl, "5m");
  assertEquals(cache._namespaces.temp.ttl, "1s");
}});  

Deno.test({
  name: "Memory Cache - Set and get operations",
  ...TEST_OPTS,
  fn: async () => {
  const cache = createTestCache({
    api: { ttl: "5m" },
  });

  await cache.api.set("test:key", { id: 1, name: "test" });
  const result = await cache.api.get<{ id: number; name: string }>("test:key");

  assertEquals(result?.id, 1);
  assertEquals(result?.name, "test");
}});

Deno.test({
  name: "Memory Cache - Get non-existent key returns null",
  ...TEST_OPTS,
  fn: async () => {
  const cache = createTestCache({
    api: { ttl: "5m" },
  });

  const result = await cache.api.get("non-existent");
  assertEquals(result, null);
}});

Deno.test({
  name: "Memory Cache - GetOrSet with factory",
  ...TEST_OPTS,
  fn: async () => {
  const cache = createTestCache({
    api: { ttl: "5m" },
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
}});

Deno.test({
  name: "Memory Cache - Delete operation",
  ...TEST_OPTS,
  fn: async () => {
  const cache = createTestCache({
    api: { ttl: "5m" },
  });

  await cache.api.set("delete:test", { value: "test" });
  await cache.api.delete("delete:test");

  const result = await cache.api.get("delete:test");
  assertEquals(result, null);
}});

Deno.test({
  name: "Memory Cache - Clear operation",
  ...TEST_OPTS,
  fn: async () => {
  const cache = createTestCache({
    api: { ttl: "5m" },
  });

  await cache.api.set("clear:1", { value: "1" });
  await cache.api.set("clear:2", { value: "2" });
  await cache.api.clear();

  const result1 = await cache.api.get("clear:1");
  const result2 = await cache.api.get("clear:2");

  assertEquals(result1, null);
  assertEquals(result2, null);
}});

Deno.test({
  name: "Memory Cache - Has operation",
  ...TEST_OPTS,
  fn: async () => {
  const cache = createTestCache({
    api: { ttl: "5m" },
  });

  assertEquals(await cache.api.has("has:test"), false);

  await cache.api.set("has:test", { value: "test" });
  assertEquals(await cache.api.has("has:test"), true);

  await cache.api.delete("has:test");
  assertEquals(await cache.api.has("has:test"), false);
}});

Deno.test({
  name: "Memory Cache - Namespace isolation",
  ...TEST_OPTS,
  fn: async () => {
  const cache = createTestCache({
    api: { ttl: "5m" },
    db: { ttl: "5m" },
  });

  await cache.api.set("shared:key", { namespace: "api" });
  await cache.db.set("shared:key", { namespace: "db" });

  const apiResult = await cache.api.get<{ namespace: string }>("shared:key");
  const dbResult = await cache.db.get<{ namespace: string }>("shared:key");

  assertEquals(apiResult?.namespace, "api");
  assertEquals(dbResult?.namespace, "db");
}});

