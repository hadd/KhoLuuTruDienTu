import type { CacheFactoryContext } from "./types.ts";

/**
 * JWT payload interface with common claims
 */
export interface JWTPayload {
  /** Expiration time (seconds since epoch) */
  exp?: number;
  /** Issued at (seconds since epoch) */
  iat?: number;
  /** Subject */
  sub?: string;
  [key: string]: unknown;
}

/**
 * Decode JWT token and extract payload
 * @param token - JWT access token
 * @returns Decoded JWT payload or null if decoding fails
 * 
 * @example
 * ```typescript
 * const payload = decodeJWT(token);
 * if (payload?.exp) {
 *   console.log('Token expires at:', new Date(payload.exp * 1000));
 * }
 * ```
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    // JWT format: header.payload.signature
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    // Decode base64url encoded payload
    const payload = parts[1];
    // Replace base64url characters with base64 characters
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    // Add padding if needed
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

    // Decode base64
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded);

    return parsed as JWTPayload;
  } catch {
    // If decoding fails, return null
    return null;
  }
}

/**
 * Get expiration timestamp from JWT token
 * @param token - JWT access token
 * @returns Expiration timestamp in seconds, or null if not found
 * 
 * @example
 * ```typescript
 * const exp = getJWTExpiration(token);
 * if (exp) {
 *   console.log('Token expires at:', new Date(exp * 1000));
 * }
 * ```
 */
export function getJWTExpiration(token: string): number | null {
  const payload = decodeJWT(token);
  if (!payload || typeof payload.exp !== "number") {
    return null;
  }
  return payload.exp;
}

/**
 * Calculate remaining TTL in seconds from JWT token
 * @param token - JWT access token
 * @returns TTL in seconds, or null if expired or invalid
 * 
 * @example
 * ```typescript
 * const ttl = calculateJWTTTL(token);
 * if (ttl) {
 *   await cache.user.set('session', data, { ttl: `${ttl}s` });
 * }
 * ```
 */
export function calculateJWTTTL(token: string): number | null {
  const exp = getJWTExpiration(token);
  if (exp === null) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const ttl = exp - now;

  // Return null if already expired or expires very soon (less than 1 second)
  if (ttl <= 0) {
    return null;
  }

  return ttl;
}

/**
 * Helper function to automatically set cache TTL from JWT token expiration
 * Use this inside getOrSet factory function to match cache TTL with JWT expiration
 * 
 * @param ctx - Cache factory context
 * @param token - JWT access token
 * @returns true if TTL was set successfully, false otherwise
 * 
 * @example
 * ```typescript
 * await cache.user.getOrSet({
 *   key: 'auth:token',
 *   factory: async (ctx) => {
 *     const userData = await verifyToken(jwt);
 *     cacheWithJWT(ctx, jwt); // Auto-set TTL from JWT
 *     return userData;
 *   }
 * });
 * ```
 */
export function cacheWithJWT(ctx: CacheFactoryContext, token: string): boolean {
  const ttl = calculateJWTTTL(token);
  if (ttl === null) {
    return false;
  }

  try {
    ctx.setOptions({ ttl: `${ttl}s` });
    return true;
  } catch {
    return false;
  }
}
