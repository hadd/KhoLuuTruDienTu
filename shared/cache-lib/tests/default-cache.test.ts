import "@shared/test-vars";
import { assertEquals, assertExists } from "@std/assert";
import { cache } from "../src/default-cache.ts";

const TEST_OPTS = {
  sanitizeOps: false,
  sanitizeResources: false,
} as const;

Deno.test({
  name: "Default Cache - Namespaces are available",
  ...TEST_OPTS,
  fn: () => {
    assertExists(cache.api);
    assertExists(cache.db);
    assertExists(cache.user);
    assertExists(cache.temp);
  },
});

Deno.test({
  name: "Default Cache - Namespace configs are correct",
  ...TEST_OPTS,
  fn: () => {
    assertEquals(cache._namespaces.api.ttl, "5m");
    assertEquals(cache._namespaces.db.ttl, "1h");
    assertEquals(cache._namespaces.user.ttl, "30m");
    assertEquals(cache._namespaces.temp.ttl, "5m");
  },
});

Deno.test({
  name: "Default Cache - Basic operations work",
  ...TEST_OPTS,
  fn: async () => {
    await cache.api.set("test:key", { value: "test" });
    const result = await cache.api.get<{ value: string }>("test:key");

    assertEquals(result?.value, "test");

    await cache.api.delete("test:key");
    const deleted = await cache.api.get("test:key");
    assertEquals(deleted, null);
  },
});

Deno.test({
  name: "Default Cache - GetOrSet works",
  ...TEST_OPTS,
  fn: async () => {
    let callCount = 0;
    const result = await cache.db.getOrSet({
      key: "default:test",
      factory: () => {
        callCount++;
        return { data: "test" };
      },
    });

    assertEquals(result.data, "test");
    assertEquals(callCount, 1);

    const cached = await cache.db.getOrSet({
      key: "default:test",
      factory: () => {
        callCount++;
        return { data: "should-not-call" };
      },
    });

    assertEquals(cached.data, "test");
    assertEquals(callCount, 1);

    await cache.db.delete("default:test");
  },
});

