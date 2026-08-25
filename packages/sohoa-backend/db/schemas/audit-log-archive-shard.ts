import { sql } from "drizzle-orm";
import { index, integer, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";

export const auditLogArchiveShardStatusValues = ["writing", "ready", "failed"] as const;
export type AuditLogArchiveShardStatus = typeof auditLogArchiveShardStatusValues[number];

export const auditLogArchiveShards = schema.table("audit_log_archive_shards", {
    id: uuid("id").defaultRandom().primaryKey(),
    objectKey: varchar("object_key", { length: 500 }).notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
    minCreatedAt: timestamp("min_created_at", { withTimezone: true }).notNull(),
    maxCreatedAt: timestamp("max_created_at", { withTimezone: true }).notNull(),
    recordCount: integer("record_count").notNull().default(0),
    uncompressedBytes: integer("uncompressed_bytes").notNull().default(0),
    compressedBytes: integer("compressed_bytes").notNull().default(0),
    checksum: varchar("checksum", { length: 64 }),
    status: varchar("status", { length: 20 }).notNull().default("writing"),
    error: text("error"),
    /**
     * Mảng UUID string của tất cả record IDs trong shard này.
     * Dùng để lookup `id → shard` cho getUnifiedById thay thế auditLogArchiveProjections (sau Track A).
     * GIN index cho `WHERE $id = ANY(record_ids)` hiệu quả.
     * Nullable trong DB để tương thích với shard cũ chưa backfill — app-layer treat null = [].
     */
    recordIds: text("record_ids").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("audit_log_archive_shards_window_idx").on(table.windowStart, table.windowEnd),
    index("audit_log_archive_shards_created_range_idx").on(table.minCreatedAt, table.maxCreatedAt),
    index("audit_log_archive_shards_status_idx").on(table.status),
    index("audit_log_archive_shards_object_key_idx").on(table.objectKey),
    index("audit_log_archive_shards_record_ids_gin_idx").using("gin", table.recordIds),
]);

export type AuditLogArchiveShard = typeof auditLogArchiveShards.$inferSelect;
export type NewAuditLogArchiveShard = typeof auditLogArchiveShards.$inferInsert;
