import { eq } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import { auditLogConfigs, auditLogSettings } from "../../db/schemas/index.ts";
import {
    AUDIT_LOG_CONFIG_CATALOG,
    catalogKey,
} from "./audit-log-config-catalog.ts";
import {
    applyDbToggles,
    invalidateAuditLogConfigCache,
    seedDefaultToggleMap,
    setAuditLogConfigCache,
} from "./audit-log-config-cache.ts";

const DEFAULT_RETENTION_DAYS = 365;

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

async function ensureSettingsRow() {
    const existing = await db.query.auditLogSettings.findFirst();
    if (existing) {
        return existing;
    }
    const [created] = await db.insert(auditLogSettings).values({
        retentionDays: DEFAULT_RETENTION_DAYS,
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

    // One-time upgrade: new view catalog keys this release → enable all catalogued views
    // that were previously seeded as disabled.
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
    setAuditLogConfigCache(toggles);
}

export const AuditLogConfigService = {
    async getGroupedConfig() {
        await loadAuditLogConfigCache();
        const rows = await db.select().from(auditLogConfigs);
        const settings = await ensureSettingsRow();
        const toggleMap = applyDbToggles(seedDefaultToggleMap(), rows);

        const groups = new Map<string, AuditLogConfigGroup>();
        for (const entry of AUDIT_LOG_CONFIG_CATALOG) {
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
                retentionDays: settings.retentionDays,
                maxRecords: settings.maxRecords,
                purgeEnabled: settings.purgeEnabled,
                lastPurgeAt: settings.lastPurgeAt,
            },
        };
    },

    async updateToggles(
        items: Array<{ module: string; actionKey: string; enabled: boolean }>,
    ) {
        for (const item of items) {
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
        invalidateAuditLogConfigCache();
        await loadAuditLogConfigCache();
        return await this.getGroupedConfig();
    },

    async updateSettings(input: {
        retentionDays: number;
        maxRecords: number | null;
        purgeEnabled: boolean;
    }) {
        if (input.maxRecords != null && input.maxRecords < 1000) {
            throw httpError.badRequest("maxRecords must be at least 1000 when set");
        }
        const settings = await ensureSettingsRow();
        const [updated] = await db.update(auditLogSettings).set({
            retentionDays: input.retentionDays,
            maxRecords: input.maxRecords,
            purgeEnabled: input.purgeEnabled,
            updatedAt: new Date(),
        }).where(eq(auditLogSettings.id, settings.id)).returning();
        return updated;
    },

    async getSettings() {
        return await ensureSettingsRow();
    },

    async markPurgeCompleted() {
        const settings = await ensureSettingsRow();
        await db.update(auditLogSettings).set({
            lastPurgeAt: new Date(),
            updatedAt: new Date(),
        }).where(eq(auditLogSettings.id, settings.id));
    },
};
