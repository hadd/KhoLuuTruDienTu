import { text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { schema } from "./schema-helper.ts";

export const metadataTemplates = schema.table("metadata_templates", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    sourceDossierId: uuid("source_dossier_id").notNull(),
    sourceOcrMetadataKey: text("source_ocr_metadata_key").notNull(),
    fieldCatalog: text("field_catalog").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    index("metadata_templates_name_idx").on(table.name),
    index("metadata_templates_active_idx")
        .on(table.id)
        .where(sql`${table.deletedAt} IS NULL`),
]);

export type MetadataTemplate = typeof metadataTemplates.$inferSelect;
export type NewMetadataTemplate = typeof metadataTemplates.$inferInsert;
