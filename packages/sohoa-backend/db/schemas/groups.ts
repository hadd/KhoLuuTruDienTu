import { text, boolean, timestamp, index, integer, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { groupMembers } from "./group_members.ts";
import { dossiers } from "./dossier.ts";
import { metadataPermissionConfigs } from "./metadata_permission_config.ts";
import { projects } from "./project.ts";
import { schema } from "./schema-helper.ts";

export const groups = schema.table("groups", {
    id: text("id").primaryKey(), // readable text ID instead of UUID
    name: text("name").notNull(),
    description: text("description"),
    projectCode: varchar("project_code", { length: 50 }).references(() => projects.projectCode, {
        onDelete: "restrict",
        onUpdate: "restrict",
    }),
    roundNumber: integer("round_number").notNull().default(3),
    dossiersPerEditor: integer("dossiers_per_editor"),
    metadataPermissionConfigId: uuid("metadata_permission_config_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    index("groups_name_idx").on(table.name),
    index("idx_groups_project_code").on(table.projectCode),
]);

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;

// Relations
export const groupsRelations = relations(groups, ({ one, many }) => ({
    groupMembers: many(groupMembers),
    dossiers: many(dossiers),
    project: one(projects, {
        fields: [groups.projectCode],
        references: [projects.projectCode],
    }),
    metadataPermissionConfig: one(metadataPermissionConfigs, {
        fields: [groups.metadataPermissionConfigId],
        references: [metadataPermissionConfigs.id],
    }),
}));
