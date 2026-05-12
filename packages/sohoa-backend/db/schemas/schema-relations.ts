import { relations } from "drizzle-orm";
import { roles } from "./role.ts";
import { userProfiles } from "./user_profile.ts";
import { userRoles } from "./user_role.ts";

export const rolesRelations = relations(roles, ({ many }) => ({
    userRoles: many(userRoles),
}));

export const userProfilesRelations = relations(userProfiles, ({ many }) => ({
    userRoles: many(userRoles),
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
