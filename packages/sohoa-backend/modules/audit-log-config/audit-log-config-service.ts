import { eq } from "drizzle-orm";
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
    if (existing.length > 0) {
        return existing;
    }
    const values = AUDIT_LOG_CONFIG_CATALOG.map((entry) => ({
        module: entry.module,
        actionKey: entry.actionKey,
        enabled: entry.defaultEnabled,
        label: entry.label,
    }));
    return await db.insert(auditLogConfigs).values(values).returning();
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

    async updateSettings(input: { retentionDays: number; purgeEnabled: boolean }) {
        const settings = await ensureSettingsRow();
        const [updated] = await db.update(auditLogSettings).set({
            retentionDays: input.retentionDays,
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
