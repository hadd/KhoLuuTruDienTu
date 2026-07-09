import { text, timestamp, index, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { userProfiles } from "./user_profile.ts";
import { groups } from "./groups.ts";
import { schema } from "./schema-helper.ts";

export const groupMemberRoleEnum = schema.enum("group_member_role", [
    "leader",
    "editor",
    "qc1",
    "qc2",  
    "qc3",
    "qc4",
    "qc5"    
]);

export const groupMembers = schema.table("group_members", {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: text("group_id").notNull().references(() => groups.id, { onDelete: "restrict", onUpdate: "restrict" }),
    userId: uuid("user_id").notNull().references(() => userProfiles.id, { onDelete: "restrict", onUpdate: "restrict" }),
    role: groupMemberRoleEnum("role").notNull().default("editor"),
    permissionSlotCode: text("permission_slot_code"),
    archivePermissionSlotCode: text("archive_permission_slot_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
}, (table) => [
    uniqueIndex("group_members_active_editor_unique")
        .on(table.groupId, table.userId)
        .where(sql`${table.expiredAt} IS NULL AND ${table.role} = 'editor'`),
    uniqueIndex("group_members_active_editor_user_unique")
        .on(table.userId)
        .where(sql`${table.expiredAt} IS NULL AND ${table.role} = 'editor'`),
    index("group_members_group_active_idx")
        .on(table.groupId)
        .where(sql`${table.expiredAt} IS NULL`),
]);

export type GroupMember = typeof groupMembers.$inferSelect;
export type NewGroupMember = typeof groupMembers.$inferInsert;
