import {
    AUDIT_LOG_CONFIG_CATALOG,
    catalogKey,
    getCatalogDefault,
} from "./audit-log-config-catalog.ts";

type ConfigCache = {
    toggles: Map<string, boolean>;
    loadedAt: number;
};

let cache: ConfigCache | null = null;

export function invalidateAuditLogConfigCache(): void {
    cache = null;
}

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

export function setAuditLogConfigCache(toggles: Map<string, boolean>): void {
    cache = { toggles, loadedAt: Date.now() };
}

export function getAuditLogConfigCache(): ConfigCache | null {
    return cache;
}

export function shouldLog(module: string | null | undefined, actionKey: string | null | undefined): boolean {
    if (!module || !actionKey) {
        return true;
    }
    const key = catalogKey(module, actionKey);
    if (!cache) {
        return getCatalogDefault(module, actionKey);
    }
    const value = cache.toggles.get(key);
    if (value === undefined) {
        return getCatalogDefault(module, actionKey);
    }
    return value;
}
