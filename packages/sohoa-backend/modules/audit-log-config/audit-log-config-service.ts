import { db } from "../../db/db-conn.ts";
import { auditLogConfigs, auditLogSettings } from "../../db/schemas/index.ts";
import { env } from "../../env.ts";
import { type UserWithRoles } from "../../libs/plugins/auth-profile.ts";
import { authHelper } from "../auth/auth-helper.ts";
import {
    AUDIT_LOG_CONFIG_CATALOG,
    AUDIT_LOG_MODULE_PERMISSIONS,
    catalogKey,
} from "./audit-log-config-catalog.ts";
import {
    applyDbToggles,
    invalidateAuditLogConfigCache,
    seedDefaultToggleMap,
    setAuditLogConfigCache,
} from "./audit-log-config-cache.ts";

export type AuditLogConfigGroup = {
    module: string;
    moduleLabel: string;
    actions: Array<{
        module: string;
        actionKey: string;
        label: string;
        enabled: boolean;
    }>;
};

function isModuleAllowedForProfile(moduleKey: string, profile?: UserWithRoles): boolean {
    if (!profile) return true;
    if (authHelper.isAdmin(profile)) return true;

    const requiredPermissions = AUDIT_LOG_MODULE_PERMISSIONS[moduleKey];
    // Special case: null means NO permission required (e.g. auth module)
    if (requiredPermissions === null) {
        return true;
    }
    if (!requiredPermissions || requiredPermissions.length === 0) {
        return true;
    }

    return authHelper.hasPermissionAny(profile, requiredPermissions);
}

async function ensureSettingsRow() {
    const existing = await db.query.auditLogSettings.findFirst();
    if (existing) {
        return existing;
    }
    const [created] = await db.insert(auditLogSettings).values({
        retentionDays: env.AUDIT_LOG_RETENTION_DAYS,
        purgeEnabled: true,
    }).returning();
    return created;
}

async function ensureConfigRows() {
    const existing = await db.select().from(auditLogConfigs);
    const existingKeys = new Set(
        existing.map((row) => catalogKey(row.module, row.actionKey)),
    );

    const missing = AUDIT_LOG_CONFIG_CATALOG.filter(
        (entry) => !existingKeys.has(catalogKey(entry.module, entry.actionKey)),
    );

    if (missing.length > 0) {
        await db.insert(auditLogConfigs).values(
            missing.map((entry) => ({
                module: entry.module,
                actionKey: entry.actionKey,
                enabled: entry.defaultEnabled,
                label: entry.label,
            })),
        );
    }

    const upgradingViewPolicy = missing.some(
        (entry) =>
            (entry.module === "data-entry" && entry.actionKey === "view") ||
            (entry.module === "physical-warehouse" && entry.actionKey === "view"),
    );
    if (upgradingViewPolicy) {
        const viewDefaultsOn = AUDIT_LOG_CONFIG_CATALOG.filter(
            (entry) => entry.actionKey === "view" && entry.defaultEnabled,
        );
        for (const entry of viewDefaultsOn) {
            await db.insert(auditLogConfigs).values({
                module: entry.module,
                actionKey: entry.actionKey,
                enabled: true,
                label: entry.label,
            }).onConflictDoUpdate({
                target: [auditLogConfigs.module, auditLogConfigs.actionKey],
                set: { enabled: true, label: entry.label },
            });
        }
    }

    return await db.select().from(auditLogConfigs);
}

export async function loadAuditLogConfigCache(): Promise<void> {
    const rows = await ensureConfigRows();
    const toggles = applyDbToggles(seedDefaultToggleMap(), rows);
    await setAuditLogConfigCache(toggles);
}

export const AuditLogConfigService = {
    async getGroupedConfig(profile?: UserWithRoles) {
        await loadAuditLogConfigCache();
        const rows = await db.select().from(auditLogConfigs);
        const settings = await ensureSettingsRow();
        const toggleMap = applyDbToggles(seedDefaultToggleMap(), rows);

        const groups = new Map<string, AuditLogConfigGroup>();
        for (const entry of AUDIT_LOG_CONFIG_CATALOG) {
            if (!isModuleAllowedForProfile(entry.module, profile)) {
                continue;
            }
            let group = groups.get(entry.module);
            if (!group) {
                group = {
                    module: entry.module,
                    moduleLabel: entry.moduleLabel,
                    actions: [],
                };
                groups.set(entry.module, group);
            }
            group.actions.push({
                module: entry.module,
                actionKey: entry.actionKey,
                label: entry.label,
                enabled: toggleMap.get(catalogKey(entry.module, entry.actionKey)) ?? entry.defaultEnabled,
            });
        }

        return {
            groups: [...groups.values()],
            settings: {
                retentionDays: env.AUDIT_LOG_RETENTION_DAYS,
                lastPurgeAt: settings.lastPurgeAt,
            },
        };
    },

    async updateToggles(
        items: Array<{ module: string; actionKey: string; enabled: boolean }>,
        profile?: UserWithRoles,
    ) {
        for (const item of items) {
            if (!isModuleAllowedForProfile(item.module, profile)) {
                continue;
            }
            const catalogEntry = AUDIT_LOG_CONFIG_CATALOG.find(
                (entry) => entry.module === item.module && entry.actionKey === item.actionKey,
            );
            if (!catalogEntry) {
                continue;
            }
            await db.insert(auditLogConfigs).values({
                module: item.module,
                actionKey: item.actionKey,
                enabled: item.enabled,
                label: catalogEntry.label,
            }).onConflictDoUpdate({
                target: [auditLogConfigs.module, auditLogConfigs.actionKey],
                set: { enabled: item.enabled },
            });
        }
        await invalidateAuditLogConfigCache();
        await loadAuditLogConfigCache();
        return await this.getGroupedConfig(profile);
    },

    async getSettings() {
        return await ensureSettingsRow();
    },
};

