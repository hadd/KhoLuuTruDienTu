import { text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { schema } from "./schema-helper.ts";

export const metadataExportPresets = schema.table("metadata_export_presets", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    columns: text("columns").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    index("metadata_export_presets_name_idx").on(table.name),
    index("metadata_export_presets_active_idx")
        .on(table.id)
        .where(sql`${table.deletedAt} IS NULL`),
]);

export type MetadataExportPreset = typeof metadataExportPresets.$inferSelect;
export type NewMetadataExportPreset = typeof metadataExportPresets.$inferInsert;
