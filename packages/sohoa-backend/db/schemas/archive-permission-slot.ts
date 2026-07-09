import { integer, jsonb, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { archivePermissionConfigs } from "./archive-permission-config.ts";

export const archivePermissionSlots = schema.table("archive_permission_slots", {
    id: uuid("id").defaultRandom().primaryKey(),
    configId: uuid("config_id").notNull().references(() => archivePermissionConfigs.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    slotCode: text("slot_code").notNull(),
    slotName: text("slot_name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    permissionKeys: jsonb("permission_keys").$type<string[]>().notNull().default([]),
    fondIds: jsonb("fond_ids").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex("archive_permission_slots_config_code_unique")
        .on(table.configId, table.slotCode),
]);

export type ArchivePermissionSlot = typeof archivePermissionSlots.$inferSelect;
export type NewArchivePermissionSlot = typeof archivePermissionSlots.$inferInsert;

export const archivePermissionSlotsRelations = relations(archivePermissionSlots, ({ one }) => ({
    config: one(archivePermissionConfigs, {
        fields: [archivePermissionSlots.configId],
        references: [archivePermissionConfigs.id],
    }),
}));
