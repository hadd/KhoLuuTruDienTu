import { text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { metadataTemplates } from "./metadata_template.ts";
import { schema } from "./schema-helper.ts";
import { metadataPermissionSlots } from "./metadata_permission_slot.ts";

export const metadataPermissionConfigStatusEnum = schema.enum("metadata_permission_config_status", [
    "draft",
    "ready",
]);

export const metadataPermissionConfigs = schema.table("metadata_permission_configs", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    templateId: uuid("template_id").notNull().references(() => metadataTemplates.id, {
        onDelete: "restrict",
        onUpdate: "restrict",
    }),
    status: metadataPermissionConfigStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    index("metadata_permission_configs_template_idx").on(table.templateId),
    index("metadata_permission_configs_active_idx")
        .on(table.id)
        .where(sql`${table.deletedAt} IS NULL`),
]);

export type MetadataPermissionConfig = typeof metadataPermissionConfigs.$inferSelect;
export type NewMetadataPermissionConfig = typeof metadataPermissionConfigs.$inferInsert;

export const metadataPermissionConfigsRelations = relations(
    metadataPermissionConfigs,
    ({ one, many }) => ({
        template: one(metadataTemplates, {
            fields: [metadataPermissionConfigs.templateId],
            references: [metadataTemplates.id],
        }),
        slots: many(metadataPermissionSlots),
    }),
);
