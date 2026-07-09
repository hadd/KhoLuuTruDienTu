import {
    boolean,
    integer,
    jsonb,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { schema } from "./schema-helper.ts";
import { archiveFieldTypeEnum, archiveReferenceSourceEnum } from "./archive-enums.ts";

export type ArchiveFieldSelectOption = {
    value: string;
    label: string;
};

export const archiveFieldConfigs = schema.table("archive_field_configs", {
    id: uuid("id").defaultRandom().primaryKey(),
    fieldKey: varchar("field_key", { length: 100 }).notNull(),
    label: varchar("label", { length: 255 }).notNull(),
    fieldType: archiveFieldTypeEnum("field_type").notNull(),
    referenceSource: archiveReferenceSourceEnum("reference_source"),
    dependsOnFieldKey: varchar("depends_on_field_key", { length: 100 }),
    isRequired: boolean("is_required").notNull().default(false),
    options: jsonb("options").$type<ArchiveFieldSelectOption[]>().notNull().default([]),
    displayOrder: integer("display_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex("uq_archive_field_configs_field_key").on(table.fieldKey),
]);

export type ArchiveFieldConfig = typeof archiveFieldConfigs.$inferSelect;
export type NewArchiveFieldConfig = typeof archiveFieldConfigs.$inferInsert;
