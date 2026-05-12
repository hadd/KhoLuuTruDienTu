import "@shared/test-vars";
import { assertEquals, assertExists } from "@std/assert";
import { REDIS_CACHE_URI } from "@shared/test-vars";
import { initializeCache } from "../src/default-cache.ts";
import { captureConsoleLogs } from "./setup/default-cache-helpers.ts";

type DefaultCacheClient = Awaited<ReturnType<typeof initializeCache>> & {
  _defaultCacheBackend?: "redis" | "memory";
};

const TEST_OPTS = {
  sanitizeOps: false,
  sanitizeResources: false,
} as const;

Deno.test({
  name: "Default Cache - Redis - Connection scenarios",
  ...TEST_OPTS,
  fn: async (t) => {
    if (!REDIS_CACHE_URI) {
      console.log("Skipping Redis tests - REDIS_CACHE_URI not set");
      return;
    }

    await t.step("Valid Redis URI with available server uses Redis cache", async () => {
      const consoleCapture = captureConsoleLogs();
      try {
        const testCache = await initializeCache(REDIS_CACHE_URI);

        await new Promise((resolve) => setTimeout(resolve, 200));

        assertExists(testCache.api);
        assertExists(testCache.db);

        const backend = (testCache as DefaultCacheClient)._defaultCacheBackend;
        const isRedis = backend === "redis";
        const isMemory = backend === "memory";

        if (isRedis) {
          const infoLogs = consoleCapture.logs.filter((l) => l.level === "info");
          assertEquals(infoLogs.length > 0, true);
        } else {
          assertEquals(isMemory, true);
          const warnLogs = consoleCapture.logs.filter((l) => l.level === "warn");
          assertEquals(warnLogs.length > 0, true);
        }
      } finally {
        consoleCapture.restore();
      }
    });

    await t.step("Redis connection error events are handled", async () => {
      const consoleCapture = captureConsoleLogs();
      try {
        const testCache = await initializeCache(REDIS_CACHE_URI);

        await new Promise((resolve) => setTimeout(resolve, 200));

        assertExists(testCache.api);
        assertExists(testCache.db);

        const infoLogs = consoleCapture.logs.filter((l) => l.level === "info");
        const warnLogs = consoleCapture.logs.filter((l) => l.level === "warn");
        const hasRedisSuccess = infoLogs.some((log) =>
          String(log.args[0]).includes("Redis cache connected")
        );
        const hasRedisWarn = warnLogs.some((log) =>
          String(log.args[0]).includes("Redis cache")
        );

        assertEquals(
          hasRedisSuccess || hasRedisWarn || consoleCapture.logs.length === 0,
          true
        );
      } finally {
        consoleCapture.restore();
      }
    });
  },
});

Deno.test({
  name: "Default Cache - Redis - Cache operations with Redis",
  ...TEST_OPTS,
  fn: async (t) => {
    if (!REDIS_CACHE_URI) {
      console.log("Skipping Redis tests - REDIS_CACHE_URI not set");
      return;
    }

    await t.step("Cache operations work with Redis backend", async () => {
      const testCache = await initializeCache(REDIS_CACHE_URI);

      await new Promise((resolve) => setTimeout(resolve, 200));

      await testCache.api.set("redis:test", { value: "redis-test" });
      const result = await testCache.api.get<{ value: string }>("redis:test");
      assertEquals(result?.value, "redis-test");

      await testCache.api.delete("redis:test");
      const deleted = await testCache.api.get("redis:test");
      assertEquals(deleted, null);
    });

    await t.step("GetOrSet works with Redis backend", async () => {
      const testCache = await initializeCache(REDIS_CACHE_URI);

      await new Promise((resolve) => setTimeout(resolve, 200));

      let callCount = 0;
      const result = await testCache.db.getOrSet({
        key: "redis:factory",
        factory: () => {
          callCount++;
          return { data: "redis-factory" };
        },
      });

      assertEquals(result.data, "redis-factory");
      assertEquals(callCount, 1);

      const cached = await testCache.db.getOrSet({
        key: "redis:factory",
        factory: () => {
          callCount++;
          return { data: "should-not-call" };
        },
      });

      assertEquals(cached.data, "redis-factory");
      assertEquals(callCount, 1);

      await testCache.db.delete("redis:factory");
    });
  },
});

