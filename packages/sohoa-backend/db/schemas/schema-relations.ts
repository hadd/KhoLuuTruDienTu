import { relations } from "drizzle-orm";
import { roles } from "./role.ts";
import { userProfiles } from "./user_profile.ts";
import { userRoles } from "./user_role.ts";
import { groups } from "./groups.ts";
import { groupMembers } from "./group_members.ts";
import { folders } from "./folder.ts";
import { dossiers } from "./dossier.ts";
import { dossierFiles } from "./dossier-file.ts";
import { dossierAssignments } from "./dossier-assignment.ts";
import { workflowLogs } from "./workflow-log.ts";
import { metadataTemplates } from "./metadata_template.ts";

export const rolesRelations = relations(roles, ({ many }) => ({
    userRoles: many(userRoles),
}));

export const userProfilesRelations = relations(userProfiles, ({ many }) => ({
    userRoles: many(userRoles),
    groupMembers: many(groupMembers),
    dossierAssignments: many(dossierAssignments),
    workflowLogs: many(workflowLogs),
}));

export const dossiersRelations = relations(dossiers, ({ one, many }) => ({
    folder: one(folders, {
        fields: [dossiers.folderId],
        references: [folders.id],
    }),
    assignedGroup: one(groups, {
        fields: [dossiers.assignedGroupId],
        references: [groups.id],
    }),
    files: many(dossierFiles),
    assignments: many(dossierAssignments),
    workflowLogs: many(workflowLogs),
    metadataTemplates: many(metadataTemplates),
}));

export const metadataTemplatesRelations = relations(metadataTemplates, ({ one }) => ({
    sourceDossier: one(dossiers, {
        fields: [metadataTemplates.sourceDossierId],
        references: [dossiers.id],
    }),
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
    parent: one(folders, {
        fields: [folders.parentId],
        references: [folders.id],
        relationName: "folderHierarchy",
    }),
    children: many(folders, { relationName: "folderHierarchy" }),
    dossiers: many(dossiers),
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
