import { text, timestamp, uuid, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { metadataPermissionConfigs } from "./metadata_permission_config.ts";
import { schema } from "./schema-helper.ts";

export const metadataPermissionSlots = schema.table("metadata_permission_slots", {
    id: uuid("id").defaultRandom().primaryKey(),
    configId: uuid("config_id").notNull().references(() => metadataPermissionConfigs.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    slotCode: text("slot_code").notNull(),
    slotName: text("slot_name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    fieldKeys: text("field_keys").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex("metadata_permission_slots_config_code_unique")
        .on(table.configId, table.slotCode),
]);

export type MetadataPermissionSlot = typeof metadataPermissionSlots.$inferSelect;
export type NewMetadataPermissionSlot = typeof metadataPermissionSlots.$inferInsert;

export const metadataPermissionSlotsRelations = relations(metadataPermissionSlots, ({ one }) => ({
    config: one(metadataPermissionConfigs, {
        fields: [metadataPermissionSlots.configId],
        references: [metadataPermissionConfigs.id],
    }),
}));
