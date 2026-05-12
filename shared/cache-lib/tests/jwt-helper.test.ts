import { assertEquals } from "@std/assert";
import {
  decodeJWT,
  getJWTExpiration,
  calculateJWTTTL,
  cacheWithJWT,
} from "../src/jwt-helper.ts";
import { createTestCache } from "./setup/helpers.ts";
import { createMockJWT } from "./setup/helpers.ts";

Deno.test("JWT Helper - Decode valid JWT", () => {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    exp: now + 3600,
    iat: now,
    sub: "user123",
    name: "Test User",
  };

  const token = createMockJWT(payload);
  const decoded = decodeJWT(token);

  assertEquals(decoded?.exp, payload.exp);
  assertEquals(decoded?.iat, payload.iat);
  assertEquals(decoded?.sub, payload.sub);
  assertEquals(decoded?.name, payload.name);
});

Deno.test("JWT Helper - Decode invalid JWT returns null", () => {
  assertEquals(decodeJWT("invalid.token"), null);
  assertEquals(decodeJWT("not-a-jwt"), null);
  assertEquals(decodeJWT(""), null);
  assertEquals(decodeJWT("header.payload"), null);
});

Deno.test("JWT Helper - Decode JWT with base64url padding", () => {
  const payload = { test: "value" };
  const token = createMockJWT(payload);
  const decoded = decodeJWT(token);

  assertEquals(decoded?.test, "value");
});

Deno.test("JWT Helper - Get JWT expiration", () => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = createMockJWT({ exp, sub: "user123" });

  const result = getJWTExpiration(token);
  assertEquals(result, exp);
});

Deno.test("JWT Helper - Get expiration from token without exp returns null", () => {
  const token = createMockJWT({ sub: "user123" });
  const result = getJWTExpiration(token);
  assertEquals(result, null);
});

Deno.test("JWT Helper - Calculate JWT TTL for valid token", () => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = createMockJWT({ exp });

  const ttl = calculateJWTTTL(token);
  assertEquals(typeof ttl, "number");
  assertEquals(ttl !== null, true);
  assertEquals(ttl! > 0, true);
  assertEquals(ttl! <= 3600, true);
});

Deno.test("JWT Helper - Calculate TTL for expired token returns null", () => {
  const exp = Math.floor(Date.now() / 1000) - 3600;
  const token = createMockJWT({ exp });

  const ttl = calculateJWTTTL(token);
  assertEquals(ttl, null);
});

Deno.test("JWT Helper - Calculate TTL for token without exp returns null", () => {
  const token = createMockJWT({ sub: "user123" });
  const ttl = calculateJWTTTL(token);
  assertEquals(ttl, null);
});

Deno.test("JWT Helper - CacheWithJWT sets TTL correctly", async () => {
  const cache = createTestCache({
    user: { ttl: "1h" },
  });

  const exp = Math.floor(Date.now() / 1000) + 300;
  const token = createMockJWT({ exp });

  let capturedOptions: { ttl?: string } | null = null;

  await cache.user.getOrSet({
    key: "jwt:test",
    factory: (ctx) => {
      const success = cacheWithJWT(ctx, token);
      assertEquals(success, true);

      const originalSetOptions = ctx.setOptions;
      ctx.setOptions = (options: { ttl?: string }) => {
        capturedOptions = options;
        originalSetOptions(options);
      };

      ctx.setOptions({ ttl: `${calculateJWTTTL(token)}s` });
      return { data: "test" };
    },
  });

  assertEquals(capturedOptions !== null, true);
  const options = capturedOptions as unknown as { ttl?: string };
  assertEquals(typeof options.ttl, "string");
  assertEquals(options.ttl?.endsWith("s"), true);
});

Deno.test("JWT Helper - CacheWithJWT returns false for expired token", () => {
  const exp = Math.floor(Date.now() / 1000) - 3600;
  const token = createMockJWT({ exp });

  let optionsSet = false;
  const mockCtx = {
    setOptions: (_opts: { ttl?: string }) => {
      optionsSet = true;
    },
  };

  const result = cacheWithJWT(mockCtx, token);
  assertEquals(result, false);
  assertEquals(optionsSet, false);
});

Deno.test("JWT Helper - CacheWithJWT returns false for invalid token", () => {
  const mockCtx = {
    setOptions: (_opts: { ttl?: string }) => {},
  };

  const result = cacheWithJWT(mockCtx, "invalid-token");
  assertEquals(result, false);
});

