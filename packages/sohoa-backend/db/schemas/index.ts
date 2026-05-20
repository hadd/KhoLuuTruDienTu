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
} from "./workflow-constants.ts";
export {
    entityTypeEnum,
    dossierStatusEnum,
    workerRoleEnum,
    assignmentStatusEnum,
} from "./workflow-enums.ts";
export { folders } from "./folder.ts";
export { dossiers } from "./dossier.ts";
export { dossierFiles, dossierFilesRelations } from "./dossier-file.ts";
export { dossierAssignments, dossierAssignmentsRelations } from "./dossier-assignment.ts";
export { workflowLogs, workflowLogsRelations } from "./workflow-log.ts";
