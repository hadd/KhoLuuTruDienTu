import { AUDIT_LOG_CONFIG_CATALOG } from "../audit-log-config/audit-log-config-catalog.ts";

export const BASIC_EVENT_TYPES = [
    "create",
    "update",
    "delete",
    "login",
    "logout",
    "login_failed",
] as const;

export type BasicEventType = typeof BASIC_EVENT_TYPES[number];

export function getModuleActionOptions(module: string): string[] {
    const actions = AUDIT_LOG_CONFIG_CATALOG
        .filter((entry) => entry.module === module)
        .map((entry) => entry.actionKey);
    return [...new Set(actions)];
}

export function getAuditLogFilterOptions() {
    const modules: Record<string, string[]> = {};
    for (const entry of AUDIT_LOG_CONFIG_CATALOG) {
        if (!modules[entry.module]) {
            modules[entry.module] = [];
        }
        if (!modules[entry.module].includes(entry.actionKey)) {
            modules[entry.module].push(entry.actionKey);
        }
    }
    return {
        basicActions: [...BASIC_EVENT_TYPES],
        modules,
    };
}

export function resolveEventTypeFilter(eventType: string | undefined, module?: string): string[] | undefined {
    if (!eventType) return undefined;
    if (!module && eventType === "update") {
        return ["update", "edit"];
    }
    return [eventType];
}
