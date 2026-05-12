import { text, timestamp, index, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { userProfiles } from "./user_profile.ts";
import { roles } from "./role.ts";
import { schema } from "./schema-helper.ts";

export const userRoles = schema.table("user_roles", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => userProfiles.id, { onDelete: "restrict", onUpdate: "restrict" }),
    roleId: text("role_id").notNull().references(() => roles.id, { onDelete: "restrict", onUpdate: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
}, (table) => [
    index("user_roles_user_id_idx").on(table.userId),
    index("user_roles_role_id_idx").on(table.roleId),
    index("user_roles_expired_at_idx").on(table.expiredAt),
    uniqueIndex("user_roles_active_unique")
        .on(table.userId, table.roleId)
        .where(sql`${table.expiredAt} IS NULL`),
]);

export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;
