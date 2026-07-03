import { relations } from "drizzle-orm";
import { roles } from "./role.ts";
import { userProfiles } from "./user_profile.ts";
import { userRoles } from "./user_role.ts";
import { groups } from "./groups.ts";
import { groupMembers } from "./group_members.ts";
import { folders } from "./folder.ts";
import { dossiers } from "./dossier.ts";
import { dossierFiles } from "./dossier-file.ts";
import { digitalSignatures } from "./digital-signature.ts";
import { dossierAssignments } from "./dossier-assignment.ts";
import { workflowLogs } from "./workflow-log.ts";
import { metadataTemplates } from "./metadata_template.ts";
import { projects } from "./project.ts";
import { projectProgressHistories } from "./project-progress-history.ts";
import { projectPlans } from "./project-plan.ts";
import { dossierIssueReports } from "./issue-report.ts";
import { paperPlans } from "./paper-plans.ts";
import { planDetails } from "./plan-details.ts";
import { paperSizes } from "./paper-size.ts";

export const rolesRelations = relations(roles, ({ many }) => ({
    userRoles: many(userRoles),
}));

export const userProfilesRelations = relations(userProfiles, ({ many }) => ({
    userRoles: many(userRoles),
    groupMembers: many(groupMembers),
    dossierAssignments: many(dossierAssignments),
    workflowLogs: many(workflowLogs),
    projectProgressHistories: many(projectProgressHistories),
    managedProjects: many(projects),
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
    project: one(projects, {
        fields: [dossiers.projectCode],
        references: [projects.projectCode],
    }),
    files: many(dossierFiles),
    assignments: many(dossierAssignments),
    workflowLogs: many(workflowLogs),
    metadataTemplates: many(metadataTemplates),
    issueReports: many(dossierIssueReports),
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
    project: one(projects, {
        fields: [folders.projectCode],
        references: [projects.projectCode],
    }),
    dossiers: many(dossiers),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
    manager: one(userProfiles, {
        fields: [projects.managerId],
        references: [userProfiles.id],
    }),
    progressHistories: many(projectProgressHistories),
    projectPlans: many(projectPlans),
    folders: many(folders),
    dossiers: many(dossiers),
    groups: many(groups),
}));

export const projectPlansRelations = relations(projectPlans, ({ one, many }) => ({
    project: one(projects, {
        fields: [projectPlans.projectCode],
        references: [projects.projectCode],
    }),
    paperPlans: many(paperPlans),
    planDetails: many(planDetails),
}));

export const projectProgressHistoriesRelations = relations(projectProgressHistories, ({ one }) => ({
    project: one(projects, {
        fields: [projectProgressHistories.projectCode],
        references: [projects.projectCode],
    }),
    updatedByUser: one(userProfiles, {
        fields: [projectProgressHistories.updatedBy],
        references: [userProfiles.id],
    }),
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

export const paperPlansRelations = relations(paperPlans, ({ one }) => ({
    projectPlan: one(projectPlans, {
        fields: [paperPlans.planId],
        references: [projectPlans.id],
    }),
    paperSize: one(paperSizes, {
        fields: [paperPlans.paperSizeId],
        references: [paperSizes.id],
    }),
}));

export const planDetailsRelations = relations(planDetails, ({ one }) => ({
    projectPlan: one(projectPlans, {
        fields: [planDetails.planId],
        references: [projectPlans.id],
    }),
}));

export const paperSizesRelations = relations(paperSizes, ({ many }) => ({
    paperPlans: many(paperPlans),
}));
