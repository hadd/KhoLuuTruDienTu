import { cache } from "@shared/cache-lib";
import {
    AUDIT_LOG_CONFIG_CATALOG,
    catalogKey,
    getCatalogDefault,
} from "./audit-log-config-catalog.ts";

/**
 * B4: Migrate từ module-level in-memory variable sang BentoCache (cache-lib).
 *
 * Khi Redis khả dụng, BentoCache dùng `redisBusDriver` để sync L1 cache giữa
 * các instance — invalidation ở instance A tự động propagate sang instance B.
 * Khi Redis down, fallback về memory cache (stale-toggle risk ngắn hạn — đã biết,
 * ghi vào docs, không phải bug).
 *
 * `shouldLog` là async vì cache.api.get() là async.
 * Tất cả callers phải await shouldLog (audit-log.ts, audit-log-view-buffer.ts).
 */

const TOGGLES_CACHE_KEY = "audit-log:config-toggles";
const TOGGLES_TTL = "10m";

export function seedDefaultToggleMap(): Map<string, boolean> {
    const toggles = new Map<string, boolean>();
    for (const entry of AUDIT_LOG_CONFIG_CATALOG) {
        toggles.set(catalogKey(entry.module, entry.actionKey), entry.defaultEnabled);
    }
    return toggles;
}

export function applyDbToggles(
    base: Map<string, boolean>,
    rows: Array<{ module: string; actionKey: string; enabled: boolean }>,
): Map<string, boolean> {
    const next = new Map(base);
    for (const row of rows) {
        next.set(catalogKey(row.module, row.actionKey), row.enabled);
    }
    return next;
}

export async function setAuditLogConfigCache(toggles: Map<string, boolean>): Promise<void> {
    // Serialize Map → plain object (JSON-serializable)
    const obj = Object.fromEntries(toggles);
    await cache.api.set(TOGGLES_CACHE_KEY, obj, { ttl: TOGGLES_TTL });
}

export async function invalidateAuditLogConfigCache(): Promise<void> {
    await cache.api.delete(TOGGLES_CACHE_KEY);
    // BentoCache bus tự broadcast delete đến L1 cache của tất cả instances khác
}

async function getAuditLogConfigToggles(): Promise<Map<string, boolean> | null> {
    const raw = await cache.api.get<Record<string, boolean>>(TOGGLES_CACHE_KEY);
    if (!raw) return null;
    return new Map(Object.entries(raw));
}

/**
 * Kiểm tra xem một audit event có được phép ghi log không.
 *
 * Async vì đọc từ BentoCache (L1 memory fast path, L2 Redis nếu miss).
 * Fallback về catalog default nếu cache chưa warm (cold start).
 */
export async function shouldLog(
    module: string | null | undefined,
    actionKey: string | null | undefined,
): Promise<boolean> {
    if (!module || !actionKey) {
        return true;
    }
    const key = catalogKey(module, actionKey);
    const toggles = await getAuditLogConfigToggles();
    if (!toggles) {
        // Cache chưa warm hoặc Redis down → dùng catalog default
        return getCatalogDefault(module, actionKey);
    }
    const value = toggles.get(key);
    return value !== undefined ? value : getCatalogDefault(module, actionKey);
}
