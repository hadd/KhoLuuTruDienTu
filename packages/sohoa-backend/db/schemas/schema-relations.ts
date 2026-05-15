import { relations } from "drizzle-orm";
import { roles } from "./role.ts";
import { userProfiles } from "./user_profile.ts";
import { userRoles } from "./user_role.ts";
import { groups } from "./groups.ts";
import { groupMembers } from "./group_members.ts";

export const rolesRelations = relations(roles, ({ many }) => ({
    userRoles: many(userRoles),
}));

export const userProfilesRelations = relations(userProfiles, ({ many }) => ({
    userRoles: many(userRoles),
    groupMembers: many(groupMembers),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
    userProfile: one(userProfiles, {
        fields: [userRoles.userId],
        references: [userProfiles.id],
    }),
    role: one(roles, {
        fields: [userRoles.roleId],
        references: [roles.id],
    }),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
    groupMembers: many(groupMembers),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
    group: one(groups, {
        fields: [groupMembers.groupId],
        references: [groups.id],
    }),
    userProfile: one(userProfiles, {
        fields: [groupMembers.userId],
        references: [userProfiles.id],
    }),
}));
