import { t } from "elysia";
import {
    assignmentStatusSchema,
    dossierStatusSchema,
    entityTypeSchema,
    workQualitySchema,
    workerRoleSchema,
} from "../../db/schemas/workflow-constants.ts";
import { issueReportResponseSchema } from "../issue-report/types.ts";

export { dossierStatusSchema, entityTypeSchema };

export const dossierEntitySchema = t.Object({
    id: t.String(),
    folderId: t.String(),
    folderPath: t.String(),
    name: t.String(),
    entityType: entityTypeSchema,
    status: dossierStatusSchema,
    requiredQcCount: t.Number(),
    currentQcStep: t.Number(),
    rejectCount: t.Number(),
    lastRejectNotes: t.Union([t.String(), t.Null()]),
    ocrMetadataKey: t.Union([t.String(), t.Null()]),
    currentMetadataKey: t.Union([t.String(), t.Null()]),
    assignedGroupId: t.Union([t.String(), t.Null()]),
    projectCode: t.Union([t.String(), t.Null()]),
    fondId: t.Union([t.String(), t.Null()]),
    createdAt: t.Union([t.Date(), t.Null()]),
    updatedAt: t.Union([t.Date(), t.Null()]),
    deletedAt: t.Union([t.Date(), t.Null()]),
});

export const createDossierSchema = t.Object({
    folderId: t.String(),
    folderPath: t.String({ maxLength: 500 }),
    name: t.String({ maxLength: 255 }),
    entityType: entityTypeSchema,
    projectCode: t.String({ minLength: 1, maxLength: 50 }),
    status: t.Optional(dossierStatusSchema),
    requiredQcCount: t.Optional(t.Number()),
    currentQcStep: t.Optional(t.Number()),
    rejectCount: t.Optional(t.Number()),
    lastRejectNotes: t.Optional(t.String()),
    ocrMetadataKey: t.Optional(t.String()),
    currentMetadataKey: t.Optional(t.String()),
    fondId: t.Optional(t.String()),
});

export const updateDossierSchema = t.Object({
    name: t.Optional(t.String({ maxLength: 255 })),
    requiredQcCount: t.Optional(t.Number()),
    fondId: t.Optional(t.String()),
    projectCode: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
});

export const ocrRunModeSchema = t.Union([t.Literal("auto"), t.Literal("manual")]);

export const createUploadPointBodySchema = t.Object({
    projectCode: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
    prefix: t.Optional(t.String()),
    expiry: t.Optional(t.Number({ minimum: 60, maximum: 604800 })),
    maxFileSize: t.Optional(t.Number({ minimum: 1 })),
    contentTypePrefix: t.Optional(t.String()),
    /** Chế độ OCR áp dụng cho toàn bộ lượt upload này: 'auto' xử lý ngay, 'manual' chờ kích hoạt thủ công. */
    runMode: t.Optional(ocrRunModeSchema),
});

export const createDocumentFromStorageBodySchema = t.Object({
    key: t.String({ minLength: 1 }),
    projectCode: t.Optional(
        t.Union([t.String({ minLength: 1, maxLength: 50 }), t.Null()]),
    ),
    /** Chế độ OCR đã chọn khi upload — được lưu vào files.ocr_run_mode. */
    runMode: t.Optional(ocrRunModeSchema),
});

export const checkFilePathQuerySchema = t.Object({
    filePath: t.String({ minLength: 1 }),
});

export const listPendingManualOcrQuerySchema = t.Object({
    page: t.Optional(t.Number({ minimum: 1 })),
    pageSize: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
    projectCode: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
    folderPath: t.Optional(t.String({ minLength: 1 })),
});

export const triggerManualOcrBodySchema = t.Object({
    dossierIds: t.Array(t.String({ format: "uuid" }), { minItems: 1 }),
});

export const assignDossierBodySchema = t.Object({
    assigneeId: t.String({ format: "uuid" }),
    role: workerRoleSchema,
});

export const assignByFolderIdBodySchema = t.Object({
    folderId: t.String({ format: "uuid" }),
    assigneeId: t.Optional(t.String({ format: "uuid" })),
    role: workerRoleSchema,
});

export const listDraftAssignmentsResponseSchema = t.Object({
    assignments: t.Array(t.Object({
        id: t.String(),
        role: workerRoleSchema,
        status: assignmentStatusSchema,
        workQuality: t.Optional(t.Union([workQualitySchema, t.Null()])),
        attemptNumber: t.Number(),
        stepNumber: t.Number(),
        assignedAt: t.Date(),
        completedAt: t.Union([t.Date(), t.Null()]),
        currentMetadataUrl: t.Union([t.String(), t.Null()]),
        dossier: t.Unknown(),
    })),
    totalAssignments: t.Number(),
});

export const listAssignmentsByRoleQuerySchema = t.Object({
    role: workerRoleSchema,
    status: t.Optional(assignmentStatusSchema),
});

const assignmentByRoleItemSchema = t.Object({
    id: t.String(),
    role: workerRoleSchema,
    status: assignmentStatusSchema,
    workQuality: t.Optional(t.Union([workQualitySchema, t.Null()])),
    attemptNumber: t.Number(),
    stepNumber: t.Number(),
    assignedAt: t.Date(),
    completedAt: t.Union([t.Date(), t.Null()]),
    currentMetadataUrl: t.Union([t.String(), t.Null()]),
    /** Thông báo vấn đề tài liệu từ biên tập — chỉ có khi role là CHECKER. */
    issueReports: t.Optional(t.Array(issueReportResponseSchema)),
    dossier: t.Unknown(),
});

export const listAssignmentsByRoleResponseSchema = t.Object({
    role: workerRoleSchema,
    status: t.Union([assignmentStatusSchema, t.Null()]),
    assignments: t.Array(assignmentByRoleItemSchema),
    totalAssignments: t.Number(),
});
