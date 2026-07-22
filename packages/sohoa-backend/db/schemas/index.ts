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
    paperPlansRelations,
    planDetailsRelations,
    paperSizesRelations,
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
export { metadataExportPresets } from "./metadata_export_preset.ts";
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
export { paperPlans } from "./paper-plans.ts";
export { planDetails } from "./plan-details.ts";
export { paperSizes } from "./paper-size.ts";

// ========================================
// Fonds & Archive Catalog
// ========================================
export { fonds } from "./fond.ts";
export { retentionPeriods } from "./retention-period.ts";
export { inventories } from "./inventory.ts";
export { dossierTypes } from "./dossier-type.ts";
export { documentTypes, documentTypesRelations } from "./document-type.ts";
export {
    ArchiveStorageState,
    ARCHIVE_STORAGE_STATE_VALUES,
    type ArchiveStorageState as ArchiveStorageStateT,
} from "./archive-storage-state-constants.ts";
export { archiveStorageStateEnum } from "./archive-storage-state-enums.ts";
export {
    physicalWarehouseItems,
    type PhysicalWarehouseItem,
    type NewPhysicalWarehouseItem,
} from "./physical-warehouse-item.ts";
export {
    DossierPhysicalPlacementStatus,
    DOSSIER_PHYSICAL_PLACEMENT_STATUS_VALUES,
    dossierPhysicalPlacementStatusSchema,
} from "./dossier-physical-placement-constants.ts";
export { dossierPhysicalPlacementStatusEnum } from "./dossier-physical-placement-enums.ts";
export {
    dossierPhysicalPlacements,
    type DossierPhysicalPlacement,
    type NewDossierPhysicalPlacement,
} from "./dossier-physical-placement.ts";

// ========================================
// Archive submission
// ========================================
export {
    ArchiveFieldType,
    ARCHIVE_FIELD_TYPE_VALUES,
    archiveFieldTypeSchema,
    ArchiveReferenceSource,
    ARCHIVE_REFERENCE_SOURCE_VALUES,
    archiveReferenceSourceSchema,
    ArchiveSubmissionStatus,
    ARCHIVE_SUBMISSION_STATUS_VALUES,
    archiveSubmissionStatusSchema,
    PHYSICAL_LOCATION_FIELD_KEY,
} from "./archive-constants.ts";
export {
    archiveFieldTypeEnum,
    archiveReferenceSourceEnum,
    archiveSubmissionStatusEnum,
} from "./archive-enums.ts";
export {
    archiveFieldConfigs,
    type ArchiveFieldConfig,
    type ArchiveFieldSelectOption,
} from "./archive-field-config.ts";
export {
    archiveSubmissions,
    archiveSubmissionsRelations,
    type ArchiveSubmission,
    type ArchiveFieldConfigSnapshot,
    type ArchiveFieldValueSnapshot,
} from "./archive-submission.ts";

export {
    archivePermissionConfigs,
    archivePermissionConfigsRelations,
    archivePermissionConfigStatusEnum,
} from "./archive-permission-config.ts";
export {
    archivePermissionSlots,
    archivePermissionSlotsRelations,
} from "./archive-permission-slot.ts";
export {
    archiveUserAssignments,
    archiveUserAssignmentsRelations,
} from "./archive-user-assignment.ts";
export {
    archiveGroupBindings,
    archiveGroupBindingsRelations,
} from "./archive-group-binding.ts";
export {
    ARCHIVE_ACL_RESOURCE_KINDS,
    ARCHIVE_ACL_PRINCIPAL_KINDS,
    archiveAclResourceKindEnum,
    archiveAclPrincipalKindEnum,
    archiveAclEntries,
    archiveAclPrincipals,
    archiveAclEntriesRelations,
    archiveAclPrincipalsRelations,
    type ArchiveAclResourceKind,
    type ArchiveAclPrincipalKind,
    type ArchiveAclEntry,
    type NewArchiveAclEntry,
    type ArchiveAclPrincipal,
    type NewArchiveAclPrincipal,
} from "./archive-acl.ts";

// ========================================
// Notifications
// ========================================
export {
    EMAIL_SENDER_CONFIG_DEFAULT_KEY,
    emailSenderConfigs,
    emailSenderConfigsRelations,
    type EmailSenderConfig,
    type NewEmailSenderConfig,
} from "./email-sender-config.ts";
export {
    notificationConfigs,
    notificationConfigChannels,
    notificationConfigRoles,
    notifications,
    notificationDeliveryStatusEnum,
    notificationDeliveries,
    notificationConfigsRelations,
    notificationConfigChannelsRelations,
    notificationConfigRolesRelations,
    notificationsRelations,
    notificationDeliveriesRelations,
    type NotificationConfig,
    type Notification,
    type NotificationDelivery,
} from "./notification.ts";

// ========================================
// Watermark (image library + placements)
// ========================================
export {
    watermarkPlacements,
    watermarkImageAssets,
    watermarkPlacementsRelations,
    watermarkImageAssetsRelations,
    watermarkPdfSecurity,
    watermarkPdfSecurityRelations,
    WATERMARK_POSITION_VALUES,
    WATERMARK_IMAGE_STATUS_VALUES,
    WATERMARK_PDF_SECURITY_DEFAULT_KEY,
    type WatermarkPlacement,
    type NewWatermarkPlacement,
    type WatermarkImageAsset,
    type NewWatermarkImageAsset,
    type WatermarkPdfSecurity,
    type NewWatermarkPdfSecurity,
    type WatermarkPosition,
    type WatermarkStamp,
    type WatermarkImageStatus,
} from "./watermark.ts";

// ========================================
// Security Levels
// ========================================
export {
    securityLevels,
    type SecurityLevel,
    type NewSecurityLevel,
} from "./security-level.ts";