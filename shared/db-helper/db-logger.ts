import { Logger as DrizzleLogger } from "drizzle-orm/logger";
import { getLogger } from "@shared/common-lib";

const DEFAULT_SLOW_QUERY_MS = 100;

const slowQueryThresholdMs = Number(
  Deno.env.get("DB_SLOW_QUERY_WARN_MS") ?? DEFAULT_SLOW_QUERY_MS,
);

class FileOnlyDbLogger implements DrizzleLogger {
  #logger = getLogger("db-query", { pretty: false });

  logQuery(query: string, params: unknown[]): void {
    this.#logger.info({ query, params }, "DB query");
  }
}

class _NoopDbLogger implements DrizzleLogger {
  logQuery(_query: string, _params: unknown[]): void {}
}

export function createDrizzleDbLogger(
  enabled: boolean,
): DrizzleLogger | undefined {
  if (!enabled) return undefined;
  return new FileOnlyDbLogger();
}

export async function withDbTiming<T>(
  operation: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const duration = performance.now() - start;
    if (duration >= slowQueryThresholdMs) {
      // eslint-disable-next-line no-console
      console.warn(
        `Slow DB operation "${operation}" took ${duration.toFixed(1)}ms (threshold ${slowQueryThresholdMs}ms)`,
      );
    }
  }
}


