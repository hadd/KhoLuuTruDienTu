import { createMemoryCacheLib } from "../../src/memory-client.ts";
import type { NamespaceConfig } from "../../src/types.ts";

export function createTestCache<T extends Record<string, NamespaceConfig>>(
  namespaces: T,
) {
  return createMemoryCacheLib({
    namespaces,
    maxSize: "10mb",
  });
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMockJWT(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${header}.${encodedPayload}.signature`;
}






















