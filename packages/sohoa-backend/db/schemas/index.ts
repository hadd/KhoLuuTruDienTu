// ========================================
// Core System & Users
// ========================================
export { apiAuditLogs } from "./api-audit-log.ts";
export { userProfiles } from "./user_profile.ts";
export {
    rolesRelations,
    userProfilesRelations,
    userRolesRelations,
    foldersRelations,
    dossiersRelations,
    metadataTemplatesRelations,
    projectsRelations,
    projectProgressHistoriesRelations,
    projectPlansRelations,
} from "./schema-relations.ts";
export { roles } from "./role.ts";
export { userRoles } from "./user_role.ts";
export { authSessions, authSessionsRelations } from "./auth_session.ts";
export {
    authSessionTokens,
    authSessionTokensRelations,
    authSessionTokenTypeEnum,
} from "./auth_session_token.ts";
// ========================================
// Groups
// ========================================
export { groups, groupsRelations } from "./groups.ts";
export { groupMembers } from "./group_members.ts";
export { groupMembersRelations } from "./schema-relations.ts";
export { metadataTemplates } from "./metadata_template.ts";
export {
    metadataPermissionConfigs,
    metadataPermissionConfigsRelations,
    metadataPermissionConfigStatusEnum,
} from "./metadata_permission_config.ts";
export {
    metadataPermissionSlots,
    metadataPermissionSlotsRelations,
} from "./metadata_permission_slot.ts";

// ========================================
// Workflow (folders, dossiers, assignments)
// ========================================
export {
    AssignmentStatus,
    ASSIGNMENT_STATUS_VALUES,
    assignmentStatusSchema,
    DossierStatus,
    DOSSIER_STATUS_VALUES,
    dossierStatusSchema,
    EntityType,
    ENTITY_TYPE_VALUES,
    entityTypeSchema,
    WorkerRole,
    WORKER_ROLE_VALUES,
    workerRoleSchema,
    WorkQuality,
    WORK_QUALITY_VALUES,
    workQualitySchema,
} from "./workflow-constants.ts";
export {
    entityTypeEnum,
    dossierStatusEnum,
    workerRoleEnum,
    assignmentStatusEnum,
    workQualityEnum,
} from "./workflow-enums.ts";
export { folders } from "./folder.ts";
export { dossiers } from "./dossier.ts";
export { dossierFiles, dossierFilesRelations } from "./dossier-file.ts";
export { digitalSignatures, digitalSignaturesRelations } from "./digital-signature.ts";
export { dossierAssignments, dossierAssignmentsRelations } from "./dossier-assignment.ts";
export { workflowLogs, workflowLogsRelations } from "./workflow-log.ts";
export { metadataHistory, metadataHistoryRelations } from "./metadata-history.ts";
export {
    IssueReportStatus,
    ISSUE_REPORT_STATUS_VALUES,
    BLOCKING_ISSUE_REPORT_STATUSES,
    issueReportStatusSchema,
} from "./issue-report-constants.ts";
export { issueReportStatusEnum } from "./issue-report-enums.ts";
export {
    dossierIssueReports,
    dossierIssueReportsRelations,
} from "./issue-report.ts";

// ========================================
// Projects
// ========================================
export { ProjectStatus, PROJECT_STATUS_VALUES } from "./project-constants.ts";
export { projects } from "./project.ts";
export { projectProgressHistories } from "./project-progress-history.ts";
export { projectPlans } from "./project-plan.ts";

// ========================================
// Fonds
// ========================================
export { fonds } from "./fond.ts";
