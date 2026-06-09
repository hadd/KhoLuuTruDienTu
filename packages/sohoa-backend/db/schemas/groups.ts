import { text, boolean, timestamp, index, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { groupMembers } from "./group_members.ts";
import { dossiers } from "./dossier.ts";
import { schema } from "./schema-helper.ts";

export const groups = schema.table("groups", {
    id: text("id").primaryKey(), // readable text ID instead of UUID
    name: text("name").notNull(),
    description: text("description"),
    roundNumber: integer("round_number").notNull().default(3),
    dossiersPerEditor: integer("dossiers_per_editor"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    index("groups_name_idx").on(table.name),
]);

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;

// Relations
export const groupsRelations = relations(groups, ({ many }) => ({
    groupMembers: many(groupMembers),
    dossiers: many(dossiers),
}));
