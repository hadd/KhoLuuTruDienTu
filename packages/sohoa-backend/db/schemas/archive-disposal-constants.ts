export const DisposalProposalCatalogStatus = {
    DRAFT: "DRAFT",
    PENDING_SUBMIT: "PENDING_SUBMIT",
    SUBMITTED: "SUBMITTED",
    APPROVED: "APPROVED",
    REJECTED: "REJECTED",
    DESTROYED: "DESTROYED",
} as const;

export type DisposalProposalCatalogStatusType =
    (typeof DisposalProposalCatalogStatus)[keyof typeof DisposalProposalCatalogStatus];

export const DISPOSAL_PROPOSAL_CATALOG_STATUS_VALUES = Object.values(
    DisposalProposalCatalogStatus,
) as [
    DisposalProposalCatalogStatusType,
    DisposalProposalCatalogStatusType,
    DisposalProposalCatalogStatusType,
    DisposalProposalCatalogStatusType,
    DisposalProposalCatalogStatusType,
    DisposalProposalCatalogStatusType,
];

/** Catalog statuses that block re-listing in expiry/duplicate candidates. */
export const ACTIVE_DISPOSAL_CATALOG_STATUSES = [
    DisposalProposalCatalogStatus.DRAFT,
    DisposalProposalCatalogStatus.PENDING_SUBMIT,
    DisposalProposalCatalogStatus.SUBMITTED,
    DisposalProposalCatalogStatus.APPROVED,
] as const;

/** Fixed row id for singleton disposal_settings. */
export const DISPOSAL_SETTINGS_SINGLETON_ID = "00000000-0000-4000-8000-000000000001";

export const DisposalCouncilMemberPositionRole = {
    CHAIR: "CHAIR",
    SECRETARY: "SECRETARY",
    MEMBER: "MEMBER",
} as const;

export type DisposalCouncilMemberPositionRoleType =
    (typeof DisposalCouncilMemberPositionRole)[keyof typeof DisposalCouncilMemberPositionRole];

export const DISPOSAL_COUNCIL_MEMBER_POSITION_ROLE_VALUES = Object.values(
    DisposalCouncilMemberPositionRole,
) as [
    DisposalCouncilMemberPositionRoleType,
    DisposalCouncilMemberPositionRoleType,
    DisposalCouncilMemberPositionRoleType,
];

export const DisposalCouncilMemberRepresentationType = {
    LEADERSHIP: "LEADERSHIP",
    ARCHIVE_DEPT: "ARCHIVE_DEPT",
    SPECIALIST_DEPT: "SPECIALIST_DEPT",
    OTHER: "OTHER",
} as const;

export type DisposalCouncilMemberRepresentationTypeType =
    (typeof DisposalCouncilMemberRepresentationType)[keyof typeof DisposalCouncilMemberRepresentationType];

export const DISPOSAL_COUNCIL_MEMBER_REPRESENTATION_TYPE_VALUES = Object.values(
    DisposalCouncilMemberRepresentationType,
) as [
    DisposalCouncilMemberRepresentationTypeType,
    DisposalCouncilMemberRepresentationTypeType,
    DisposalCouncilMemberRepresentationTypeType,
    DisposalCouncilMemberRepresentationTypeType,
];

export const DisposalCouncilMemberHistoryAction = {
    CREATE: "CREATE",
    ADD: "ADD",
    REMOVE: "REMOVE",
    UPDATE: "UPDATE",
} as const;

export type DisposalCouncilMemberHistoryActionType =
    (typeof DisposalCouncilMemberHistoryAction)[keyof typeof DisposalCouncilMemberHistoryAction];

export const DISPOSAL_COUNCIL_MEMBER_HISTORY_ACTION_VALUES = Object.values(
    DisposalCouncilMemberHistoryAction,
) as [
    DisposalCouncilMemberHistoryActionType,
    DisposalCouncilMemberHistoryActionType,
    DisposalCouncilMemberHistoryActionType,
    DisposalCouncilMemberHistoryActionType,
];

export const DisposalCouncilReviewResult = {
    APPROVED: "APPROVED",
    REJECTED: "REJECTED",
} as const;

export type DisposalCouncilReviewResultType =
    (typeof DisposalCouncilReviewResult)[keyof typeof DisposalCouncilReviewResult];

export const DISPOSAL_COUNCIL_REVIEW_RESULT_VALUES = Object.values(
    DisposalCouncilReviewResult,
) as [DisposalCouncilReviewResultType, DisposalCouncilReviewResultType];

export const MIN_DISPOSAL_COUNCIL_MEMBERS = 5;

export const MANDATORY_DISPOSAL_COUNCIL_REPRESENTATION_TYPES = [
    DisposalCouncilMemberRepresentationType.LEADERSHIP,
    DisposalCouncilMemberRepresentationType.ARCHIVE_DEPT,
    DisposalCouncilMemberRepresentationType.SPECIALIST_DEPT,
] as const;

export const DisposalProposalItemSource = {
    EXPIRED: "EXPIRED",
    EXPIRING_SOON: "EXPIRING_SOON",
    DUPLICATE: "DUPLICATE",
    WAREHOUSE: "WAREHOUSE",
} as const;

export type DisposalProposalItemSourceType =
    (typeof DisposalProposalItemSource)[keyof typeof DisposalProposalItemSource];

export const DISPOSAL_PROPOSAL_ITEM_SOURCE_VALUES = Object.values(
    DisposalProposalItemSource,
) as [
    DisposalProposalItemSourceType,
    DisposalProposalItemSourceType,
    DisposalProposalItemSourceType,
    DisposalProposalItemSourceType,
];

export const DuplicateDetectionRuleKey = {
    DOSSIER_NAME: "DOSSIER_NAME",
    HO_SO_ID: "HO_SO_ID",
    DOSSIER_CODE: "DOSSIER_CODE",
    FILE_NAME_SIZE: "FILE_NAME_SIZE",
} as const;

export type DuplicateDetectionRuleKeyType =
    (typeof DuplicateDetectionRuleKey)[keyof typeof DuplicateDetectionRuleKey];

export const DUPLICATE_DETECTION_RULE_KEY_VALUES = Object.values(
    DuplicateDetectionRuleKey,
) as [
    DuplicateDetectionRuleKeyType,
    DuplicateDetectionRuleKeyType,
    DuplicateDetectionRuleKeyType,
    DuplicateDetectionRuleKeyType,
];
