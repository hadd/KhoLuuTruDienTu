import { text, timestamp, index, uuid, pgEnum } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { userProfiles } from "./user_profile.ts";
import { groups } from "./groups.ts";
import { schema } from "./schema-helper.ts";

export const groupMemberRoleEnum = schema.enum("group_member_role", [
    "leader",
    "member",
]);

export const groupMembers = schema.table("group_members", {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: text("group_id").notNull().references(() => groups.id, { onDelete: "restrict", onUpdate: "restrict" }),
    userId: uuid("user_id").notNull().references(() => userProfiles.id, { onDelete: "restrict", onUpdate: "restrict" }),
    role: groupMemberRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
}, (table) => [
    index("group_members_group_id_idx").on(table.groupId),
    index("group_members_user_id_idx").on(table.userId),
    index("group_members_role_idx").on(table.role),
    index("group_members_expired_at_idx").on(table.expiredAt),
    index("group_members_active_idx").on(table.groupId, table.role).where(sql`${table.expiredAt} IS NULL`),
    index("group_members_user_active_idx").on(table.userId, table.groupId).where(sql`${table.expiredAt} IS NULL`),
]);

export type GroupMember = typeof groupMembers.$inferSelect;
export type NewGroupMember = typeof groupMembers.$inferInsert;
