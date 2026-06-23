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
    WAITING_CHECKER_3: "WAITING_CHECKER_3",
    CHECKER_3_PROCESSING: "CHECKER_3_PROCESSING",
    CHECKER_3_REJECTED: "CHECKER_3_REJECTED",
    WAITING_CHECKER_4: "WAITING_CHECKER_4",
    CHECKER_4_PROCESSING: "CHECKER_4_PROCESSING",
    CHECKER_4_REJECTED: "CHECKER_4_REJECTED",
    WAITING_CHECKER_5: "WAITING_CHECKER_5",
    CHECKER_5_PROCESSING: "CHECKER_5_PROCESSING",
    CHECKER_5_REJECTED: "CHECKER_5_REJECTED",
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
    CHECKER_3: "CHECKER_3",
    CHECKER_4: "CHECKER_4",
    CHECKER_5: "CHECKER_5",
} as const;

export type WorkerRole = (typeof WorkerRole)[keyof typeof WorkerRole];

export const WORKER_ROLE_VALUES = Object.values(WorkerRole) as [
    WorkerRole,
    WorkerRole,
    ...WorkerRole[],
];

export const MAX_QC_CHECKER_STEPS = 5;

export type QcCheckerWorkflowStep = {
    step: number;
    role: WorkerRole;
    waiting: DossierStatus;
    processing: DossierStatus;
    rejected: DossierStatus;
};

export const QC_CHECKER_WORKFLOW: readonly QcCheckerWorkflowStep[] = [
    {
        step: 1,
        role: WorkerRole.CHECKER_1,
        waiting: DossierStatus.WAITING_CHECKER_1,
        processing: DossierStatus.CHECKER_1_PROCESSING,
        rejected: DossierStatus.CHECKER_1_REJECTED,
    },
    {
        step: 2,
        role: WorkerRole.CHECKER_2,
        waiting: DossierStatus.WAITING_CHECKER_2,
        processing: DossierStatus.CHECKER_2_PROCESSING,
        rejected: DossierStatus.CHECKER_2_REJECTED,
    },
    {
        step: 3,
        role: WorkerRole.CHECKER_3,
        waiting: DossierStatus.WAITING_CHECKER_3,
        processing: DossierStatus.CHECKER_3_PROCESSING,
        rejected: DossierStatus.CHECKER_3_REJECTED,
    },
    {
        step: 4,
        role: WorkerRole.CHECKER_4,
        waiting: DossierStatus.WAITING_CHECKER_4,
        processing: DossierStatus.CHECKER_4_PROCESSING,
        rejected: DossierStatus.CHECKER_4_REJECTED,
    },
    {
        step: 5,
        role: WorkerRole.CHECKER_5,
        waiting: DossierStatus.WAITING_CHECKER_5,
        processing: DossierStatus.CHECKER_5_PROCESSING,
        rejected: DossierStatus.CHECKER_5_REJECTED,
    },
] as const;

export const CHECKER_REJECTED_STATUSES = QC_CHECKER_WORKFLOW.map((c) => c.rejected);

export const workerRoleSchema = t.Enum(WorkerRole);

export const AssignmentStatus = {
    IN_PROGRESS: "IN_PROGRESS",
    DRAFT: "DRAFT",
    COMPLETED: "COMPLETED",
    REJECTED: "REJECTED",
    TRANSFERRED: "TRANSFERRED",
} as const;

export type AssignmentStatus = (typeof AssignmentStatus)[keyof typeof AssignmentStatus];

/** Phân công đang được biên tập/duyệt (chưa gửi bước tiếp theo). */
export const WORKABLE_ASSIGNMENT_STATUSES = [
    AssignmentStatus.IN_PROGRESS,
    AssignmentStatus.DRAFT,
] as const;

export const ASSIGNMENT_STATUS_VALUES = Object.values(AssignmentStatus) as [
    AssignmentStatus,
    AssignmentStatus,
    AssignmentStatus,
    AssignmentStatus,
    AssignmentStatus,
];

export const QC_CHECKER_BY_STEP = new Map(
    QC_CHECKER_WORKFLOW.map((config) => [config.step, config]),
);

export const assignmentStatusSchema = t.Enum(AssignmentStatus);

/** Chất lượng công việc của một lần phân công (đúng / sai). */
export const WorkQuality = {
    CORRECT: "CORRECT",
    INCORRECT: "INCORRECT",
} as const;

export type WorkQuality = (typeof WorkQuality)[keyof typeof WorkQuality];

export const WORK_QUALITY_VALUES = Object.values(WorkQuality) as [
    WorkQuality,
    WorkQuality,
];

export const workQualitySchema = t.Enum(WorkQuality);
