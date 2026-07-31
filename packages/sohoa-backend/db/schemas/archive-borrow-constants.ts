export const ArchiveBorrowMedium = {
    ELECTRONIC: "ELECTRONIC",
    PHYSICAL: "PHYSICAL",
} as const;

export type ArchiveBorrowMediumType =
    (typeof ArchiveBorrowMedium)[keyof typeof ArchiveBorrowMedium];

export const ARCHIVE_BORROW_MEDIUM_VALUES = Object.values(ArchiveBorrowMedium) as [
    ArchiveBorrowMediumType,
    ArchiveBorrowMediumType,
];

export const ArchiveBorrowStatus = {
    PENDING: "PENDING",
    APPROVED: "APPROVED",
    REJECTED: "REJECTED",
    ACTIVE: "ACTIVE",
    EXPIRED: "EXPIRED",
    DELIVERED: "DELIVERED",
    RETURNED: "RETURNED",
} as const;

export type ArchiveBorrowStatusType =
    (typeof ArchiveBorrowStatus)[keyof typeof ArchiveBorrowStatus];

export const ARCHIVE_BORROW_STATUS_VALUES = Object.values(ArchiveBorrowStatus) as [
    ArchiveBorrowStatusType,
    ArchiveBorrowStatusType,
    ArchiveBorrowStatusType,
    ArchiveBorrowStatusType,
    ArchiveBorrowStatusType,
    ArchiveBorrowStatusType,
    ArchiveBorrowStatusType,
];

export const ArchiveBorrowItemKind = {
    FILE: "FILE",
    DOSSIER: "DOSSIER",
    PHYSICAL_DOSSIER: "PHYSICAL_DOSSIER",
} as const;

export type ArchiveBorrowItemKindType =
    (typeof ArchiveBorrowItemKind)[keyof typeof ArchiveBorrowItemKind];

export const ARCHIVE_BORROW_ITEM_KIND_VALUES = Object.values(ArchiveBorrowItemKind) as [
    ArchiveBorrowItemKindType,
    ArchiveBorrowItemKindType,
    ArchiveBorrowItemKindType,
];

export const ArchiveBorrowDipStatus = {
    PENDING: "PENDING",
    READY: "READY",
    FAILED: "FAILED",
    REVOKED: "REVOKED",
} as const;

export type ArchiveBorrowDipStatusType =
    (typeof ArchiveBorrowDipStatus)[keyof typeof ArchiveBorrowDipStatus];

export const ARCHIVE_BORROW_DIP_STATUS_VALUES = Object.values(ArchiveBorrowDipStatus) as [
    ArchiveBorrowDipStatusType,
    ArchiveBorrowDipStatusType,
    ArchiveBorrowDipStatusType,
    ArchiveBorrowDipStatusType,
];

export const ArchiveBorrowDipLayout = {
    ZIP: "ZIP",
    UNPACKED: "UNPACKED",
} as const;

export type ArchiveBorrowDipLayoutType =
    (typeof ArchiveBorrowDipLayout)[keyof typeof ArchiveBorrowDipLayout];

export const ARCHIVE_BORROW_DIP_LAYOUT_VALUES = Object.values(ArchiveBorrowDipLayout) as [
    ArchiveBorrowDipLayoutType,
    ArchiveBorrowDipLayoutType,
];

/** Open statuses that block duplicate electronic borrow of same scope. */
export const ARCHIVE_BORROW_ELECTRONIC_OPEN_STATUSES = [
    ArchiveBorrowStatus.PENDING,
    ArchiveBorrowStatus.APPROVED,
    ArchiveBorrowStatus.ACTIVE,
] as const;

export const ELECTRONIC_ITEM_KINDS = [
    ArchiveBorrowItemKind.FILE,
    ArchiveBorrowItemKind.DOSSIER,
] as const;
