import { assertEquals, assertExists } from "@std/assert";
import { initializeCache } from "../src/default-cache.ts";
import {
  captureConsoleLogs,
} from "./setup/default-cache-helpers.ts";

const TEST_OPTS = {
  sanitizeOps: false,
  sanitizeResources: false,
} as const;

Deno.test({
  name: "Default Cache Fallback - Invalid Redis URL falls back to memory",
  ...TEST_OPTS,
  fn: async () => {
    const logCapture = captureConsoleLogs();
    try {
      const cache = await initializeCache("redis://invalid-host:6379");

      assertExists(cache.api);
      assertExists(cache.db);
      assertExists(cache.user);
      assertExists(cache.temp);

      const hasWarning = logCapture.logs.some(
        (log) =>
          log.level === "warn" &&
          ((log.args[0] as string)?.includes("Redis cache unavailable") ||
            (log.args[0] as string)?.includes("Failed to initialize Redis cache"))
      );
      assertEquals(hasWarning, true);
    } finally {
      logCapture.restore();
    }
  },
});

Deno.test({
  name: "Default Cache Fallback - Unreachable Redis URL falls back to memory",
  ...TEST_OPTS,
  fn: async () => {
    const logCapture = captureConsoleLogs();
    try {
      const cache = await initializeCache("redis://localhost:9999");

      assertExists(cache.api);
      assertExists(cache.db);
      assertExists(cache.user);
      assertExists(cache.temp);

      await cache.api.set("test:key", { value: "test" });
      const result = await cache.api.get<{ value: string }>("test:key");
      assertEquals(result?.value, "test");

      await cache.api.delete("test:key");
      const deleted = await cache.api.get("test:key");
      assertEquals(deleted, null);
    } finally {
      logCapture.restore();
    }
  },
});

Deno.test({
  name: "Default Cache Fallback - Malformed URL falls back to memory",
  ...TEST_OPTS,
  fn: async () => {
    const logCapture = captureConsoleLogs();
    try {
      const cache = await initializeCache("redis://invalid-format");

      assertExists(cache.api);
      assertExists(cache.db);
      assertExists(cache.user);
      assertExists(cache.temp);

      await cache.db.set("fallback:test", { data: "works" });
      const result = await cache.db.get<{ data: string }>("fallback:test");
      assertEquals(result?.data, "works");

      const hasWarning = logCapture.logs.some(
        (log) =>
          log.level === "warn" &&
          ((log.args[0] as string)?.includes("Failed to initialize Redis cache") ||
            (log.args[0] as string)?.includes("Redis cache unavailable"))
      );
      assertEquals(hasWarning, true);
    } finally {
      logCapture.restore();
    }
  },
});

Deno.test({
  name: "Default Cache Fallback - Cache operations work after fallback",
  ...TEST_OPTS,
  fn: async () => {
    const cache = await initializeCache("redis://invalid-host:6379");


    await cache.user.set("user:1", { id: 1, name: "Test User" });
    const user = await cache.user.get<{ id: number; name: string }>("user:1");
    assertEquals(user?.id, 1);
    assertEquals(user?.name, "Test User");

    await cache.temp.set("temp:1", { value: "temp" });
    const temp = await cache.temp.get<{ value: string }>("temp:1");
    assertEquals(temp?.value, "temp");

    await cache.user.delete("user:1");
    await cache.temp.delete("temp:1");

    assertEquals(await cache.user.get("user:1"), null);
    assertEquals(await cache.temp.get("temp:1"), null);
  },
});

