import { assertEquals } from "@std/assert";
import { BentoCache, bentostore } from "bentocache";
import { memoryDriver } from "bentocache/drivers/memory";
import { createNamespaceProxy } from "../src/namespace-proxy.ts";

const TEST_OPTS = {
  sanitizeOps: false,
  sanitizeResources: false,
} as const;
Deno.test("Namespace Proxy - Key prefixing", TEST_OPTS, async () => {
  const bento = new BentoCache({
    default: "memory",
    stores: {
      memory: bentostore().useL1Layer(memoryDriver({ maxSize: "10mb" })),
    },
  });

  const proxy = createNamespaceProxy(bento, "test", { ttl: "5m" });

  await proxy.set("key1", { value: "test" });

  const namespace = bento.namespace("test");
  const directGet = await namespace.get<{ value: string }>({ key: "test:key1" });
  const proxyGet = await proxy.get<{ value: string }>("key1");

  assertEquals(directGet?.value, "test");
  assertEquals(proxyGet?.value, "test");
});

Deno.test("Namespace Proxy - All methods work", TEST_OPTS, async () => {
  const bento = new BentoCache({
    default: "memory",
    stores: {
      memory: bentostore().useL1Layer(memoryDriver({ maxSize: "10mb" })),
    },
  });

  const proxy = createNamespaceProxy(bento, "methods-test", { ttl: "5m" });

  await proxy.set("test:1", { id: 1 });
  const getResult = await proxy.get<{ id: number }>("test:1");
  assertEquals(getResult?.id, 1);

  const hasResult = await proxy.has("test:1");
  assertEquals(hasResult, true);

  const getOrSetResult = await proxy.getOrSet({
    key: "test:2",
    factory: async () => ({ id: 2 }),
  });
  assertEquals(getOrSetResult.id, 2);

  await proxy.delete("test:1");
  const deletedResult = await proxy.get("test:1");
  assertEquals(deletedResult, null);

  await proxy.set("test:3", { id: 3 });
  await proxy.clear();
  const clearedResult = await proxy.get("test:3");
  assertEquals(clearedResult, null);
});

