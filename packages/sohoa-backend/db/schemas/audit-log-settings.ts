import { boolean, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";
import { t } from "elysia";

export const auditLogSettings = schema.table("audit_log_settings", {
    id: uuid("id").defaultRandom().primaryKey(),
    retentionDays: integer("retention_days").notNull().default(365),
    maxRecords: integer("max_records"),
    purgeEnabled: boolean("purge_enabled").notNull().default(true),
    lastPurgeAt: timestamp("last_purge_at", { withTimezone: true }),
    /** End of last fully processed scheduled retention window. Count-triggered purges do not advance this. */
    purgeCursorUntil: timestamp("purge_cursor_until", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLogSettings = typeof auditLogSettings.$inferSelect;
export type NewAuditLogSettings = typeof auditLogSettings.$inferInsert;

export const auditLogSettingsEntitySchema = t.Object({
    id: t.String(),
    retentionDays: t.Number(),
    maxRecords: t.Union([t.Number(), t.Null()]),
    purgeEnabled: t.Boolean(),
    lastPurgeAt: t.Union([t.Date(), t.Null()]),
    purgeCursorUntil: t.Union([t.Date(), t.Null()]),
    updatedAt: t.Union([t.Date(), t.Null()]),
});
