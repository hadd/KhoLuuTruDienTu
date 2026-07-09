import { index, jsonb, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schema } from "./schema-helper.ts";
import { userProfiles } from "./user_profile.ts";
import { archivePermissionConfigs } from "./archive-permission-config.ts";

export const archiveUserAssignments = schema.table("archive_user_assignments", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => userProfiles.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    configId: uuid("config_id").notNull().references(() => archivePermissionConfigs.id, {
        onDelete: "cascade",
        onUpdate: "restrict",
    }),
    slotCode: text("slot_code").notNull(),
    fondIds: jsonb("fond_ids").$type<string[]>().notNull().default([]),
    assignedBy: uuid("assigned_by").references(() => userProfiles.id, {
        onDelete: "set null",
        onUpdate: "restrict",
    }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
    uniqueIndex("archive_user_assignments_user_config_slot_unique")
        .on(table.userId, table.configId, table.slotCode),
    index("idx_archive_user_assignments_user").on(table.userId),
]);

export type ArchiveUserAssignment = typeof archiveUserAssignments.$inferSelect;
export type NewArchiveUserAssignment = typeof archiveUserAssignments.$inferInsert;

export const archiveUserAssignmentsRelations = relations(archiveUserAssignments, ({ one }) => ({
    user: one(userProfiles, {
        fields: [archiveUserAssignments.userId],
        references: [userProfiles.id],
    }),
    config: one(archivePermissionConfigs, {
        fields: [archiveUserAssignments.configId],
        references: [archivePermissionConfigs.id],
    }),
}));
