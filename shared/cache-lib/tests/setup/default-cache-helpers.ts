import type { BaseCacheClient } from "../../src/types.ts";

export type MockRedisClient = {
  connect: () => Promise<void>;
  status: string;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  emit: (event: string, ...args: unknown[]) => void;
  removeAllListeners: () => void;
  quit: () => Promise<void>;
};

export function createMockRedisClient(
  options: {
    connectSucceeds?: boolean;
    connectThrows?: boolean;
    status?: string;
    constructorThrows?: boolean;
  } = {},
): MockRedisClient {
  const {
    connectSucceeds = true,
    connectThrows = false,
    status = "ready",
    constructorThrows = false,
  } = options;

  if (constructorThrows) {
    throw new Error("Redis constructor failed");
  }

  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

  const mockClient: MockRedisClient = {
    status,
    connect: async () => {
      if (connectThrows) {
        throw new Error("Connection failed");
      }
      if (!connectSucceeds) {
        throw new Error("Connection rejected");
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
      mockClient.status = status;
      if (listeners.connect) {
        listeners.connect.forEach((handler) => handler());
      }
    },
    on: (event: string, handler: (...args: unknown[]) => void) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(handler);
    },
    emit: (event: string, ...args: unknown[]) => {
      if (listeners[event]) {
        listeners[event].forEach((handler) => handler(...args));
      }
    },
    removeAllListeners: () => {
      Object.keys(listeners).forEach((key) => delete listeners[key]);
    },
    quit: () => {
      mockClient.removeAllListeners();
      return Promise.resolve();
    },
  };

  return mockClient;
}

export function verifyCacheType(
  cache: BaseCacheClient,
  expectedType: "redis" | "memory",
): boolean {
  const bento = cache._bento as any;
  
  try {
    const stores = bento.stores || bento._stores || {};
    const storeNames = Object.keys(stores);
    
    if (expectedType === "redis") {
      return storeNames.includes("redis-cache");
    } else {
      return storeNames.includes("memory") && !storeNames.includes("redis-cache");
    }
  } catch {
    return false;
  }
}

export function captureConsoleLogs() {
  const logs: Array<{ level: string; args: unknown[] }> = [];
  const originalWarn = console.warn;
  const originalInfo = console.info;

  console.warn = (...args: unknown[]) => {
    logs.push({ level: "warn", args });
    originalWarn(...args);
  };

  console.info = (...args: unknown[]) => {
    logs.push({ level: "info", args });
    originalInfo(...args);
  };

  return {
    logs,
    restore: () => {
      console.warn = originalWarn;
      console.info = originalInfo;
    },
  };
}

