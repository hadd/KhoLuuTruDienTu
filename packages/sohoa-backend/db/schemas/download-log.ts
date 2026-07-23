import {
    boolean,
    index,
    jsonb,
    text,
    timestamp,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";
import { userProfiles } from "./user_profile.ts";

export const DOWNLOAD_EXPORT_TYPE_VALUES = ["metadata", "dip"] as const;
export type DownloadExportType = (typeof DOWNLOAD_EXPORT_TYPE_VALUES)[number];

export const DOWNLOAD_SCOPE_VALUES = ["dossier", "folder", "batch"] as const;
export type DownloadScope = (typeof DOWNLOAD_SCOPE_VALUES)[number];

export const downloadLogs = schema.table("download_logs", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .notNull()
        .references(() => userProfiles.id, {
            onDelete: "cascade",
            onUpdate: "restrict",
        }),
    exportType: varchar("export_type", { length: 32 }).notNull(),
    scope: varchar("scope", { length: 32 }).notNull(),
    resourceIds: jsonb("resource_ids").$type<Record<string, unknown>>().notNull()
        .default({}),
    applyWatermark: boolean("apply_watermark").notNull().default(false),
    placementId: uuid("placement_id"),
    success: boolean("success").notNull(),
    errorMessage: text("error_message"),
    ip: varchar("ip", { length: 50 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    index("download_logs_user_id_idx").on(table.userId),
    index("download_logs_created_at_idx").on(table.createdAt),
    index("download_logs_user_created_idx").on(table.userId, table.createdAt),
]);

export type DownloadLog = typeof downloadLogs.$inferSelect;
export type NewDownloadLog = typeof downloadLogs.$inferInsert;
