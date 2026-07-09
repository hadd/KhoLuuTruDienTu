import { t } from "elysia";

export const ArchiveFieldType = {
    TEXT: "TEXT",
    TEXTAREA: "TEXTAREA",
    NUMBER: "NUMBER",
    DATE: "DATE",
    SELECT: "SELECT",
    REFERENCE: "REFERENCE",
} as const;

export type ArchiveFieldType = (typeof ArchiveFieldType)[keyof typeof ArchiveFieldType];

export const ARCHIVE_FIELD_TYPE_VALUES = Object.values(ArchiveFieldType) as [
    ArchiveFieldType,
    ArchiveFieldType,
    ArchiveFieldType,
    ArchiveFieldType,
    ArchiveFieldType,
    ArchiveFieldType,
];

export const archiveFieldTypeSchema = t.Enum(ArchiveFieldType);

export const ArchiveReferenceSource = {
    FOND: "FOND",
    INVENTORY: "INVENTORY",
    RETENTION_PERIOD: "RETENTION_PERIOD",
    DOSSIER_TYPE: "DOSSIER_TYPE",
} as const;

export type ArchiveReferenceSource =
    (typeof ArchiveReferenceSource)[keyof typeof ArchiveReferenceSource];

export const ARCHIVE_REFERENCE_SOURCE_VALUES = Object.values(ArchiveReferenceSource) as [
    ArchiveReferenceSource,
    ArchiveReferenceSource,
    ArchiveReferenceSource,
    ArchiveReferenceSource,
];

export const archiveReferenceSourceSchema = t.Enum(ArchiveReferenceSource);

export const ArchiveSubmissionStatus = {
    PENDING: "PENDING",
    APPROVED: "APPROVED",
    REJECTED: "REJECTED",
} as const;

export type ArchiveSubmissionStatus =
    (typeof ArchiveSubmissionStatus)[keyof typeof ArchiveSubmissionStatus];

export const ARCHIVE_SUBMISSION_STATUS_VALUES = Object.values(ArchiveSubmissionStatus) as [
    ArchiveSubmissionStatus,
    ArchiveSubmissionStatus,
    ArchiveSubmissionStatus,
];

export const archiveSubmissionStatusSchema = t.Enum(ArchiveSubmissionStatus);
