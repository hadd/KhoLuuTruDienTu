import { t } from "elysia";

export const EntityType = {
    DOSSIER: "DOSSIER",
    DOCUMENT: "DOCUMENT",
} as const;

export type EntityType = (typeof EntityType)[keyof typeof EntityType];

export const ENTITY_TYPE_VALUES = Object.values(EntityType) as [EntityType, EntityType];

export const entityTypeSchema = t.Enum(EntityType);

export const DossierStatus = {
    NEW: "NEW",
    OCR_PROCESSING: "OCR_PROCESSING",
    OCR_FAILED: "OCR_FAILED",
    READY_FOR_ENTRY: "READY_FOR_ENTRY",
    ENTRY_PROCESSING: "ENTRY_PROCESSING",
    WAITING_CHECKER_1: "WAITING_CHECKER_1",
    CHECKER_1_PROCESSING: "CHECKER_1_PROCESSING",
    CHECKER_1_REJECTED: "CHECKER_1_REJECTED",
    WAITING_CHECKER_2: "WAITING_CHECKER_2",
    CHECKER_2_PROCESSING: "CHECKER_2_PROCESSING",
    CHECKER_2_REJECTED: "CHECKER_2_REJECTED",
    APPROVED: "APPROVED",
} as const;

export type DossierStatus = (typeof DossierStatus)[keyof typeof DossierStatus];

export const DOSSIER_STATUS_VALUES = Object.values(DossierStatus) as [
    DossierStatus,
    DossierStatus,
    ...DossierStatus[],
];

export const dossierStatusSchema = t.Enum(DossierStatus);

export const WorkerRole = {
    MAKER: "MAKER",
    CHECKER_1: "CHECKER_1",
    CHECKER_2: "CHECKER_2",
} as const;

export type WorkerRole = (typeof WorkerRole)[keyof typeof WorkerRole];

export const WORKER_ROLE_VALUES = Object.values(WorkerRole) as [
    WorkerRole,
    WorkerRole,
    WorkerRole,
];

export const workerRoleSchema = t.Enum(WorkerRole);

export const AssignmentStatus = {
    IN_PROGRESS: "IN_PROGRESS",
    COMPLETED: "COMPLETED",
    REJECTED: "REJECTED",
} as const;

export type AssignmentStatus = (typeof AssignmentStatus)[keyof typeof AssignmentStatus];

export const ASSIGNMENT_STATUS_VALUES = Object.values(AssignmentStatus) as [
    AssignmentStatus,
    AssignmentStatus,
    AssignmentStatus,
];

export const assignmentStatusSchema = t.Enum(AssignmentStatus);
