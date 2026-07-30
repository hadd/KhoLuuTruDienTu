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
