import { text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { userRoles } from "./user_role.ts";
import { schema } from "./schema-helper.ts";

export const roles = schema.table("roles", {
    id: text("id").primaryKey(), // readable text ID instead of UUID
    name: text("name").notNull(),
    description: text("description"),
    rules: text("rules").notNull(), // JSON field for permissions/rules
    hiddenModules: text("hidden_modules").notNull().default("[]"), // JSON array of hidden modules
    hiddenPermissions: text("hidden_permissions").notNull().default("[]"), // JSON array of hidden permissions
    isBaseRole: boolean("is_base_role").notNull().default(false), // marks base roles that cannot be deleted
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
    index("roles_name_idx").on(table.name),
    index("roles_is_base_role_idx").on(table.isBaseRole),
    index("roles_active_idx").on(table.name, table.isBaseRole).where(sql`${table.deletedAt} IS NULL`),
]);

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
// Relations
export const rolesRelations = relations(roles, ({ many }) => ({
    userRoles: many(userRoles),
}));

