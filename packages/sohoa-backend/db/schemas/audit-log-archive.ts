import { integer, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { index } from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";
import { t } from "elysia";

export const auditLogArchiveStatusValues = ["exported", "purged", "failed"] as const;
export type AuditLogArchiveStatus = typeof auditLogArchiveStatusValues[number];

export const auditLogArchives = schema.table("audit_log_archives", {
    id: uuid("id").defaultRandom().primaryKey(),
    exportedAt: timestamp("exported_at", { withTimezone: true }).notNull().defaultNow(),
    dateFrom: timestamp("date_from", { withTimezone: true }).notNull(),
    dateTo: timestamp("date_to", { withTimezone: true }).notNull(),
    recordCount: integer("record_count").notNull().default(0),
    jsonObjectKey: varchar("json_object_key", { length: 500 }),
    excelObjectKey: varchar("excel_object_key", { length: 500 }),
    purgedCount: integer("purged_count").notNull().default(0),
    status: varchar("status", { length: 20 }).notNull().default("exported"),
    error: text("error"),
}, (table) => [
    index("audit_log_archives_exported_at_idx").on(table.exportedAt),
    index("audit_log_archives_status_idx").on(table.status),
]);

export type AuditLogArchive = typeof auditLogArchives.$inferSelect;
export type NewAuditLogArchive = typeof auditLogArchives.$inferInsert;

export const auditLogArchiveEntitySchema = t.Object({
    id: t.String(),
    exportedAt: t.Union([t.Date(), t.Null()]),
    dateFrom: t.Union([t.Date(), t.Null()]),
    dateTo: t.Union([t.Date(), t.Null()]),
    recordCount: t.Number(),
    jsonObjectKey: t.Union([t.String(), t.Null()]),
    excelObjectKey: t.Union([t.String(), t.Null()]),
    purgedCount: t.Number(),
    status: t.String(),
    error: t.Union([t.String(), t.Null()]),
});
