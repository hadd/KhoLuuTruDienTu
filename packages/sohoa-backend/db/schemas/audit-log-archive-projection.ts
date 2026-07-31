import { integer, text, timestamp, uuid, varchar, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { auditLogArchiveShards } from "./audit-log-archive-shard.ts";

export const auditLogArchiveProjections = schema.table("audit_log_archive_projections", {
    id: uuid("id").primaryKey(),
    shardId: uuid("shard_id").notNull().references(() => auditLogArchiveShards.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    userId: uuid("user_id"),
    userRole: varchar("user_role", { length: 50 }),
    method: varchar("method", { length: 10 }).notNull(),
    path: varchar("path", { length: 500 }).notNull(),
    action: varchar("action", { length: 100 }),
    module: varchar("module", { length: 50 }),
    eventType: varchar("event_type", { length: 50 }),
    entityType: varchar("entity_type", { length: 50 }),
    entityId: varchar("entity_id", { length: 100 }),
    entityLabel: varchar("entity_label", { length: 500 }),
    summary: text("summary"),
    statusCode: integer("status_code").notNull(),
    viewCount: integer("view_count").notNull().default(1),
}, (table) => [
    index("audit_log_archive_projections_created_at_desc_idx").on(sql`${table.createdAt} DESC`),
    index("audit_log_archive_projections_module_created_idx").on(table.module, table.createdAt),
    index("audit_log_archive_projections_event_type_created_idx").on(table.eventType, table.createdAt),
    index("audit_log_archive_projections_user_created_idx").on(table.userId, table.createdAt),
    index("audit_log_archive_projections_shard_id_idx").on(table.shardId),
]);

export type AuditLogArchiveProjection = typeof auditLogArchiveProjections.$inferSelect;
export type NewAuditLogArchiveProjection = typeof auditLogArchiveProjections.$inferInsert;
