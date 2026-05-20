import { text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { groupMembers } from "./group_members.ts";
import { schema } from "./schema-helper.ts";

export const groups = schema.table("groups", {
    id: text("id").primaryKey(), // readable text ID instead of UUID
    name: text("name").notNull(),
    description: text("description"),
    isPublic: boolean("is_public").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    index("groups_name_idx").on(table.name),
    index("groups_is_public_idx").on(table.isPublic),
    index("groups_active_idx").on(table.name, table.isPublic).where(sql`${table.deletedAt} IS NULL`),
]);

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;

// Relations
export const groupsRelations = relations(groups, ({ many }) => ({
    groupMembers: many(groupMembers),
}));
