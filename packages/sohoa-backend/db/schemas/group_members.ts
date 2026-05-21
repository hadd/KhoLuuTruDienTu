import { text, timestamp, index, uuid, pgEnum } from "drizzle-orm/pg-core";
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
}, (table) => [
]);

export type GroupMember = typeof groupMembers.$inferSelect;
export type NewGroupMember = typeof groupMembers.$inferInsert;
