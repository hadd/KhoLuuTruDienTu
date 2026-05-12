# Cache Library

A lean cache library wrapping bentocache with namespace-based configuration, Redis support, and typed namespace bindings.

## Features

- Two client types: in-memory (zero-config) and Redis-backed
- Namespace-based configuration with custom TTL per namespace
- Typed namespace access with full autocomplete
- JWT token helpers for auto-setting cache TTL from token expiration
- Multi-tier caching: Memory (L1) + Redis (L2) with pub/sub sync

## Quick Start

### Default Cache (No Init Required)

```typescript
import { cache } from "@shared/cache-lib";

// Use immediately with pre-configured namespaces
await cache.api.set('users:list', userData);
const users = await cache.api.get('users:list');
await cache.user.set('session:123', sessionData);
await cache.temp.clear();
```

Pre-configured namespaces: `api` (5m), `db` (1h), `user` (30m), `temp` (5m)

### Custom In-Memory Cache

```typescript
import { createMemoryCacheLib } from "@shared/cache-lib";

const cache = createMemoryCacheLib({
  namespaces: {
    api: { ttl: '5m' },
    temp: { ttl: '2m' }
  },
  maxSize: '100mb'
});
```

### Redis-Backed Cache

```typescript
import { Redis } from 'ioredis';
import { createRedisCacheLib } from "@shared/cache-lib";

const redisClient = new Redis({ host: 'localhost', port: 6379 });

const cache = createRedisCacheLib({
  redis: redisClient,
  namespaces: {
    api: { ttl: '5m' },
    db: { ttl: '1h' },
    user: { ttl: '30m' }
  }
});
```

## API Reference

### Cache Namespace Methods

#### `get<T>(key: string): Promise<T | null>`

```typescript
const user = await cache.user.get<User>('session:123');
```

#### `set<T>(key: string, value: T, options?: CacheOptions): Promise<void>`

```typescript
// Use namespace default TTL
await cache.api.set('users:list', users);

// Override TTL
await cache.api.set('users:list', users, { ttl: '10m' });
```

#### `getOrSet<T>(params: GetOrSetParams<T>): Promise<T>`

```typescript
const posts = await cache.db.getOrSet({
  key: 'posts:list',
  factory: async () => await fetchPostsFromDB()
});

// With TTL override
const user = await cache.user.getOrSet({
  key: 'profile:123',
  factory: async () => fetchUser(123),
  ttl: '1h'
});
```

#### `delete(key: string): Promise<void>`

```typescript
await cache.api.delete('users:list');
```

#### `clear(): Promise<void>`

```typescript
await cache.api.clear();
```

#### `has(key: string): Promise<boolean>`

```typescript
const exists = await cache.api.has('users:list');
```

## JWT Token Helpers

### `cacheWithJWT(ctx, token)`

Auto-set cache TTL from JWT expiration:

```typescript
import { cacheWithJWT } from "@shared/cache-lib";

await cache.user.getOrSet({
  key: 'auth:token',
  factory: async (ctx) => {
    const userData = await verifyToken(jwtToken);
    cacheWithJWT(ctx, jwtToken);
    return userData;
  }
});
```

### Other JWT Helpers

```typescript
import { getJWTExpiration, calculateJWTTTL, decodeJWT } from "@shared/cache-lib";

const exp = getJWTExpiration(token);        // Get expiration timestamp
const ttl = calculateJWTTTL(token);         // Calculate remaining seconds
const payload = decodeJWT(token);           // Decode JWT payload
```

## Advanced Usage

### Dynamic TTL

```typescript
await cache.user.getOrSet({
  key: 'dynamic-data',
  factory: async (ctx) => {
    const result = await fetchData();
    
    if (result.priority === 'high') {
      ctx.setOptions({ ttl: '1h' });
    } else {
      ctx.setOptions({ ttl: '5m' });
    }
    
    return result;
  }
});
```

### Environment-based Configuration

```typescript
const isProduction = Deno.env.get('NODE_ENV') === 'production';

const cache = isProduction
  ? createRedisCacheLib({ redis: redisClient, namespaces: { ... } })
  : createMemoryCacheLib({ namespaces: { ... } });
```

## Real-World Example

```typescript
import { createMemoryCacheLib, cacheWithJWT } from "@shared/cache-lib";

const cache = createMemoryCacheLib({
  namespaces: {
    auth: { ttl: '30m' },
    api: { ttl: '5m' }
  }
});

// Verify and cache Supabase token
export async function verifySupabaseToken(token: string) {
  return await cache.auth.getOrSet({
    key: `token:${token}`,
    factory: async (ctx) => {
      const supabase = createSupabaseClient();
      const { data, error } = await supabase.auth.getUser(token);
      
      if (error) throw new Error("Invalid token");
      
      cacheWithJWT(ctx, token);
      return data.user;
    }
  });
}

// Cache API responses
export async function getUsers() {
  return await cache.api.getOrSet({
    key: 'users:list',
    factory: async () => await db.select().from(users)
  });
}
```

## Key Format Convention

Use colon-separated format: `entity:id` or `entity:action`

```typescript
await cache.user.get('session:123');
await cache.api.get('posts:list');
await cache.db.get('user:456:profile');
```

## TypeScript Support

```typescript
const cache = createMemoryCacheLib({
  namespaces: {
    api: { ttl: '5m' },
    user: { ttl: '30m' }
  }
});

// Full autocomplete for namespaces and methods
cache.api.   // Shows: get, set, getOrSet, delete, clear, has

// Type safety for cached values
interface User { id: string; name: string; }
const user = await cache.user.get<User>('session:123');
// user is typed as User | null
```
