import { index, jsonb, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { groups } from "./groups.ts";
import { archivePermissionConfigs } from "./archive-permission-config.ts";

export const archiveGroupBindings = schema.table("archive_group_bindings", {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: text("group_id").notNull().references(() => groups.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    configId: uuid("config_id").notNull().references(() => archivePermissionConfigs.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    fondIds: jsonb("fond_ids").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex("archive_group_bindings_group_unique").on(table.groupId),
    index("idx_archive_group_bindings_config").on(table.configId),
]);

export type ArchiveGroupBinding = typeof archiveGroupBindings.$inferSelect;
export type NewArchiveGroupBinding = typeof archiveGroupBindings.$inferInsert;

export const archiveGroupBindingsRelations = relations(archiveGroupBindings, ({ one }) => ({
    group: one(groups, {
        fields: [archiveGroupBindings.groupId],
        references: [groups.id],
    }),
    config: one(archivePermissionConfigs, {
        fields: [archiveGroupBindings.configId],
        references: [archivePermissionConfigs.id],
    }),
}));
