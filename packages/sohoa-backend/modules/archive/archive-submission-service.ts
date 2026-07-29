import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import {
    ArchiveFieldType,
    ArchiveReferenceSource,
    ArchiveSubmissionStatus,
} from "../../db/schemas/archive-constants.ts";
import type { ArchiveFieldConfig } from "../../db/schemas/archive-field-config.ts";
import {
    archiveSubmissions,
    type ArchiveFieldConfigSnapshot,
    type ArchiveFieldValueSnapshot,
} from "../../db/schemas/archive-submission.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { toSearchablePdfKey } from "../dossier/dossier-path-utils.ts";
import { assertActiveSecurityLevelId } from "../security-level/security-clearance.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { DossierStatus } from "../../db/schemas/workflow-constants.ts";
import type { DossierStatus as DossierStatusType } from "../../db/schemas/workflow-constants.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import {
    assertDossierStatusAllowsArchiveSubmit,
    assertDossierStatusAllowsArchiveReview,
} from "../../libs/dossier-workflow-guards.ts";
import { ArchiveFieldConfigService } from "./archive-field-config-service.ts";
import {
    resolveReferenceLabel,
    validateInventoryBelongsToFond,
    validateReferenceValue,
} from "./archive-reference-validator.ts";
import { enqueueDossierIndex } from "../search/search-index-queue.ts";
import { PHYSICAL_LOCATION_FIELD_KEY } from "../../db/schemas/archive-constants.ts";
import { PlacementService } from "../physical-warehouse/physical-placement-service.ts";
import {
    insertWorkflowLog,
    queueWorkflowAuditFromLog,
    type WorkflowLogWriteInput,
} from "../workflow-log/workflow-log-write.ts";
import {
    buildArchiveMetadataSubmitPatch,
    extractArchivePrefillFromMetadata,
    loadDossierMetadataForArchive,
    patchMetadataForArchiveSubmit,
    persistDossierMetadataForArchive,
    resolveFondIdFromMetadataValue,
} from "./archive-metadata-sync.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const SUBMITTABLE_DOSSIER_STATUSES = [
    DossierStatus.APPROVED,
    DossierStatus.ARCHIVE_REJECTED,
] as const;

export const ARCHIVE_LIST_DOSSIER_STATUSES = [
    DossierStatus.APPROVED,
    DossierStatus.PENDING_ARCHIVE,
    DossierStatus.ARCHIVED,
    DossierStatus.ARCHIVE_REJECTED,
] as const;

export type ArchiveListDossierStatus = (typeof ARCHIVE_LIST_DOSSIER_STATUSES)[number];

export type ArchiveSubmitFileSecurityItem = {
    fileId: string;
    securityLevelId: string;
};

function isArchiveSubmitPdfFile(file: { fileName: string; filePath: string }): boolean {
    if (file.fileName.toLowerCase().endsWith(".pdf")) {
        return true;
    }
    if (file.filePath.toLowerCase().endsWith(".pdf")) {
        return true;
    }
    return toSearchablePdfKey(file.filePath) !== null;
}

async function listPdfFilesForArchiveSubmit(dossierId: string) {
    const files = await db.query.dossierFiles.findMany({
        where: eq(dossierFiles.dossierId, dossierId),
        columns: {
            id: true,
            fileName: true,
            filePath: true,
            securityLevelId: true,
        },
        orderBy: asc(dossierFiles.fileName),
    });
    return files.filter(isArchiveSubmitPdfFile);
}

async function validateArchiveSubmitSecurity(
    dossierId: string,
    securityLevelId: string,
    fileSecurityLevels: ArchiveSubmitFileSecurityItem[],
): Promise<void> {
    await assertActiveSecurityLevelId(securityLevelId);

    const pdfFiles = await listPdfFilesForArchiveSubmit(dossierId);
    const expectedIds = new Set(pdfFiles.map((file) => file.id));
    const providedIds = new Set(fileSecurityLevels.map((item) => item.fileId));

    if (expectedIds.size !== providedIds.size) {
        throw httpError.badRequest(
            "Danh sách cấp độ bảo mật file không khớp với số file PDF của hồ sơ",
        );
    }

    for (const expectedId of expectedIds) {
        if (!providedIds.has(expectedId)) {
            throw httpError.badRequest(
                "Thiếu cấp độ bảo mật cho một hoặc nhiều file PDF",
            );
        }
    }

    for (const item of fileSecurityLevels) {
        if (!expectedIds.has(item.fileId)) {
            throw httpError.badRequest("File không thuộc hồ sơ hoặc không phải PDF");
        }
        await assertActiveSecurityLevelId(item.securityLevelId);
    }
}

function isEmptyValue(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === "string") return value.trim() === "";
    return false;
}

function parseNumberValue(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function isValidDateValue(value: unknown): boolean {
    if (typeof value !== "string" || value.trim() === "") return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime());
}

async function validateFieldValues(
    configs: ArchiveFieldConfig[],
    fieldValues: ArchiveFieldValueSnapshot,
): Promise<ArchiveFieldConfigSnapshot> {
    const activeConfigs = configs.filter((config) => config.isActive);
    const resolvedLabels: Record<string, { id: string; label: string }> = {};
    const configByKey = new Map(activeConfigs.map((config) => [config.fieldKey, config]));
    const providedKeys = new Set(Object.keys(fieldValues));

    for (const config of activeConfigs) {
        const rawValue = fieldValues[config.fieldKey];

        if (config.isRequired && isEmptyValue(rawValue)) {
            throw httpError.badRequest(`Trường "${config.label}" là bắt buộc`);
        }

        if (isEmptyValue(rawValue)) {
            continue;
        }

        switch (config.fieldType) {
            case ArchiveFieldType.TEXT:
            case ArchiveFieldType.TEXTAREA:
                if (typeof rawValue !== "string") {
                    throw httpError.badRequest(`Trường "${config.label}" phải là chuỗi`);
                }
                break;
            case ArchiveFieldType.NUMBER: {
                const parsed = parseNumberValue(rawValue);
                if (parsed === null) {
                    throw httpError.badRequest(`Trường "${config.label}" phải là số`);
                }
                break;
            }
            case ArchiveFieldType.DATE:
                if (!isValidDateValue(rawValue)) {
                    throw httpError.badRequest(`Trường "${config.label}" phải là ngày hợp lệ`);
                }
                break;
            case ArchiveFieldType.SELECT: {
                if (typeof rawValue !== "string") {
                    throw httpError.badRequest(`Trường "${config.label}" phải chọn một giá trị`);
                }
                const allowed = new Set((config.options ?? []).map((option) => option.value));
                if (!allowed.has(rawValue)) {
                    throw httpError.badRequest(`Giá trị "${config.label}" không hợp lệ`);
                }
                break;
            }
            case ArchiveFieldType.REFERENCE: {
                if (typeof rawValue !== "string") {
                    throw httpError.badRequest(`Trường "${config.label}" phải chọn một giá trị`);
                }
                if (!config.referenceSource) {
                    throw httpError.badRequest(`Trường "${config.label}" chưa cấu hình nguồn tham chiếu`);
                }
                await validateReferenceValue(config.referenceSource, rawValue);
                if (
                    config.referenceSource === ArchiveReferenceSource.INVENTORY
                    && config.dependsOnFieldKey
                ) {
                    const fondValue = fieldValues[config.dependsOnFieldKey];
                    if (typeof fondValue !== "string" || fondValue.trim() === "") {
                        throw httpError.badRequest("Phải chọn phông trước khi chọn mục lục");
                    }
                    await validateInventoryBelongsToFond(rawValue, fondValue);
                }
                const label = await resolveReferenceLabel(config.referenceSource, rawValue);
                if (label) {
                    resolvedLabels[config.fieldKey] = { id: rawValue, label };
                }
                break;
            }
            default:
                throw httpError.badRequest(`Loại trường "${config.fieldType}" không được hỗ trợ`);
        }
    }

    for (const key of providedKeys) {
        if (!configByKey.has(key)) {
            throw httpError.badRequest(`Trường "${key}" không có trong cấu hình lưu kho`);
        }
    }

    return {
        fields: activeConfigs,
        resolvedLabels,
    };
}

function resolveFondIdFromSubmission(
    snapshot: ArchiveFieldConfigSnapshot,
    fieldValues: ArchiveFieldValueSnapshot,
): string | null {
    const fondField = snapshot.fields.find(
        (field) => field.referenceSource === ArchiveReferenceSource.FOND,
    );
    if (!fondField) return null;
    const value = fieldValues[fondField.fieldKey];
    return typeof value === "string" && value.trim() !== "" ? value : null;
}

function resolveDossierTypeIdFromSubmission(
    snapshot: ArchiveFieldConfigSnapshot,
    fieldValues: ArchiveFieldValueSnapshot,
): string | null {
    const typeField = snapshot.fields.find(
        (field) => field.referenceSource === ArchiveReferenceSource.DOSSIER_TYPE,
    );
    if (typeField) {
        const value = fieldValues[typeField.fieldKey];
        if (typeof value === "string" && value.trim() !== "") return value.trim();
    }
    const fallback = fieldValues.dossier_type;
    return typeof fallback === "string" && fallback.trim() !== ""
        ? fallback.trim()
        : null;
}

export const ArchiveSubmissionService = {
    listActiveFieldConfigs() {
        return ArchiveFieldConfigService.listActiveFieldConfigs();
    },

    async listArchiveDossiers(query: {
        page?: number;
        limit?: number;
        status?: ArchiveListDossierStatus;
        search?: string;
    }) {
        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(100, Math.max(1, query.limit ?? 20));
        const offset = (page - 1) * limit;

        const statusFilter = query.status
            ? [query.status]
            : [DossierStatus.APPROVED];

        const searchTerm = query.search?.trim();
        const searchCondition = searchTerm
            ? or(
                ilike(dossiers.name, `%${searchTerm}%`),
                ilike(dossiers.folderPath, `%${searchTerm}%`),
            )
            : undefined;

        const whereClause = activeDossierWhere(
            inArray(dossiers.status, statusFilter),
            ...(searchCondition ? [searchCondition] : []),
        );

        const [rows, countRows] = await Promise.all([
            db
                .select({
                    id: dossiers.id,
                    name: dossiers.name,
                    folderPath: dossiers.folderPath,
                    status: dossiers.status,
                    projectCode: dossiers.projectCode,
                    fondId: dossiers.fondId,
                    updatedAt: dossiers.updatedAt,
                })
                .from(dossiers)
                .where(whereClause)
                .orderBy(desc(dossiers.updatedAt))
                .limit(limit)
                .offset(offset),
            db
                .select({ count: sql<number>`count(*)::int` })
                .from(dossiers)
                .where(whereClause),
        ]);

        const dossierIds = rows.map((row) => row.id);
        const latestSubmissionByDossier = new Map<string, {
            id: string;
            status: string;
            submittedAt: Date;
            submittedBy: string;
            submitterName: string | null;
            rejectNotes: string | null;
        }>();

        if (dossierIds.length > 0) {
            const latestSubmissions = await db
                .selectDistinctOn([archiveSubmissions.dossierId], {
                    id: archiveSubmissions.id,
                    dossierId: archiveSubmissions.dossierId,
                    status: archiveSubmissions.status,
                    submittedAt: archiveSubmissions.submittedAt,
                    submittedBy: archiveSubmissions.submittedBy,
                    submitterName: userProfiles.fullName,
                    rejectNotes: archiveSubmissions.rejectNotes,
                })
                .from(archiveSubmissions)
                .leftJoin(userProfiles, eq(archiveSubmissions.submittedBy, userProfiles.id))
                .where(inArray(archiveSubmissions.dossierId, dossierIds))
                .orderBy(archiveSubmissions.dossierId, desc(archiveSubmissions.submittedAt));

            for (const submission of latestSubmissions) {
                latestSubmissionByDossier.set(submission.dossierId, submission);
            }
        }

        const items = rows.map((row) => ({
            ...row,
            latestSubmission: latestSubmissionByDossier.get(row.id) ?? null,
        }));

        const total = countRows[0]?.count ?? 0;
        return {
            items,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        };
    },

    async getSubmissionsByDossier(dossierId: string) {
        return db
            .select({
                id: archiveSubmissions.id,
                dossierId: archiveSubmissions.dossierId,
                submittedBy: archiveSubmissions.submittedBy,
                submitterName: userProfiles.fullName,
                submitterEmail: userProfiles.email,
                submittedAt: archiveSubmissions.submittedAt,
                status: archiveSubmissions.status,
                reviewedBy: archiveSubmissions.reviewedBy,
                reviewedAt: archiveSubmissions.reviewedAt,
                rejectNotes: archiveSubmissions.rejectNotes,
                fieldValues: archiveSubmissions.fieldValues,
                fieldConfigSnapshot: archiveSubmissions.fieldConfigSnapshot,
                createdAt: archiveSubmissions.createdAt,
            })
            .from(archiveSubmissions)
            .leftJoin(userProfiles, eq(archiveSubmissions.submittedBy, userProfiles.id))
            .where(eq(archiveSubmissions.dossierId, dossierId))
            .orderBy(desc(archiveSubmissions.submittedAt));
    },

    async getPendingSubmissions(query: { page?: number; limit?: number }) {
        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(100, Math.max(1, query.limit ?? 20));
        const offset = (page - 1) * limit;

        const whereClause = eq(archiveSubmissions.status, ArchiveSubmissionStatus.PENDING);

        const [items, countRows] = await Promise.all([
            db
                .select({
                    id: archiveSubmissions.id,
                    dossierId: archiveSubmissions.dossierId,
                    dossierName: dossiers.name,
                    dossierStatus: dossiers.status,
                    folderPath: dossiers.folderPath,
                    submittedBy: archiveSubmissions.submittedBy,
                    submitterName: userProfiles.fullName,
                    submitterEmail: userProfiles.email,
                    submittedAt: archiveSubmissions.submittedAt,
                    status: archiveSubmissions.status,
                    fieldValues: archiveSubmissions.fieldValues,
                    fieldConfigSnapshot: archiveSubmissions.fieldConfigSnapshot,
                })
                .from(archiveSubmissions)
                .innerJoin(dossiers, eq(archiveSubmissions.dossierId, dossiers.id))
                .leftJoin(userProfiles, eq(archiveSubmissions.submittedBy, userProfiles.id))
                .where(whereClause)
                .orderBy(desc(archiveSubmissions.submittedAt))
                .limit(limit)
                .offset(offset),
            db
                .select({ count: sql<number>`count(*)::int` })
                .from(archiveSubmissions)
                .where(whereClause),
        ]);

        const total = countRows[0]?.count ?? 0;
        return {
            items,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        };
    },

    async getSubmission(id: string) {
        const [row] = await db
            .select({
                id: archiveSubmissions.id,
                dossierId: archiveSubmissions.dossierId,
                dossierName: dossiers.name,
                dossierStatus: dossiers.status,
                folderPath: dossiers.folderPath,
                submittedBy: archiveSubmissions.submittedBy,
                submitterName: userProfiles.fullName,
                submitterEmail: userProfiles.email,
                submittedAt: archiveSubmissions.submittedAt,
                status: archiveSubmissions.status,
                reviewedBy: archiveSubmissions.reviewedBy,
                reviewedAt: archiveSubmissions.reviewedAt,
                rejectNotes: archiveSubmissions.rejectNotes,
                fieldValues: archiveSubmissions.fieldValues,
                fieldConfigSnapshot: archiveSubmissions.fieldConfigSnapshot,
            })
            .from(archiveSubmissions)
            .innerJoin(dossiers, eq(archiveSubmissions.dossierId, dossiers.id))
            .leftJoin(userProfiles, eq(archiveSubmissions.submittedBy, userProfiles.id))
            .where(eq(archiveSubmissions.id, id))
            .limit(1);

        if (!row) {
            throw httpError.notFound("Đơn nộp lưu kho không tồn tại");
        }
        return row;
    },

    async prepareArchiveSubmit(dossierId: string) {
        const dossier = await db.query.dossiers.findFirst({
            where: activeDossierWhere(eq(dossiers.id, dossierId)),
            columns: {
                id: true,
                status: true,
                securityLevelId: true,
                fondId: true,
            },
        });
        if (!dossier) {
            throw httpError.notFound("Hồ sơ không tồn tại");
        }
        assertDossierStatusAllowsArchiveSubmit(dossier.status);

        const pdfFiles = await listPdfFilesForArchiveSubmit(dossierId);
        const dbFiles = pdfFiles.map((file) => ({
            id: file.id,
            fileName: file.fileName,
            securityLevelId: file.securityLevelId ?? null,
        }));

        let suggestedFieldValues: Record<string, string> = {};
        let dossierSecurityLevelId = dossier.securityLevelId ?? null;
        let files = dbFiles;

        try {
            const metadata = await loadDossierMetadataForArchive(dossierId);
            const prefill = await extractArchivePrefillFromMetadata(metadata, {
                dossierFondId: dossier.fondId,
                dossierSecurityLevelId: dossier.securityLevelId,
                pdfFiles: pdfFiles.map((file) => ({
                    id: file.id,
                    filePath: file.filePath,
                    securityLevelId: file.securityLevelId,
                })),
            });
            suggestedFieldValues = prefill.suggestedFieldValues;
            dossierSecurityLevelId = prefill.dossierSecurityLevelId;
            files = dbFiles.map((file) => ({
                ...file,
                securityLevelId: prefill.fileSecurityByFileId[file.id] ?? file.securityLevelId,
            }));
        } catch (error) {
            if (dossier.fondId) {
                suggestedFieldValues = { fond: dossier.fondId };
            }
            console.warn(
                "[ArchiveSubmission] prepareArchiveSubmit metadata prefill skipped:",
                error,
            );
        }

        return {
            dossierId: dossier.id,
            dossierSecurityLevelId,
            files,
            suggestedFieldValues,
        };
    },

    async submitToArchive(
        dossierId: string,
        userId: string,
        fieldValues: ArchiveFieldValueSnapshot,
        security: {
            securityLevelId: string;
            fileSecurityLevels: ArchiveSubmitFileSecurityItem[];
        },
    ) {
        const dossier = await db.query.dossiers.findFirst({
            where: activeDossierWhere(eq(dossiers.id, dossierId)),
            columns: { id: true, status: true, name: true, folderPath: true },
        });
        if (!dossier) {
            throw httpError.notFound("Hồ sơ không tồn tại");
        }
        assertDossierStatusAllowsArchiveSubmit(dossier.status);

        const configs = await ArchiveFieldConfigService.listActiveFieldConfigs();
        if (configs.length === 0) {
            throw httpError.badRequest("Chưa cấu hình trường thông tin lưu kho");
        }

        const snapshot = await validateFieldValues(configs, fieldValues);
        await validateArchiveSubmitSecurity(
            dossierId,
            security.securityLevelId,
            security.fileSecurityLevels,
        );

        const pdfFiles = await listPdfFilesForArchiveSubmit(dossierId);
        const pdfFileById = new Map(pdfFiles.map((file) => [file.id, file]));
        const fondFieldValue = fieldValues.fond;
        const fondId = typeof fondFieldValue === "string" && fondFieldValue.trim() !== ""
            ? (await resolveFondIdFromMetadataValue(fondFieldValue)) ?? fondFieldValue.trim()
            : null;

        const metadata = await loadDossierMetadataForArchive(dossierId);
        const patch = await buildArchiveMetadataSubmitPatch({
            fondId,
            dossierSecurityLevelId: security.securityLevelId,
            fileSecurityLevels: security.fileSecurityLevels.map((item) => ({
                fileId: item.fileId,
                filePath: pdfFileById.get(item.fileId)?.filePath ?? "",
                securityLevelId: item.securityLevelId,
            })),
        });
        const patchedMetadata = patchMetadataForArchiveSubmit(metadata, patch);
        await persistDossierMetadataForArchive(dossierId, patchedMetadata);

        const now = new Date();

        let workflowAudit: WorkflowLogWriteInput | null = null;
        let workflowLogId: string | null = null;

        const submission = await db.transaction(async (tx) => {
            const [submissionRow] = await tx
                .insert(archiveSubmissions)
                .values({
                    dossierId,
                    submittedBy: userId,
                    submittedAt: now,
                    status: ArchiveSubmissionStatus.PENDING,
                    fieldValues,
                    fieldConfigSnapshot: snapshot,
                })
                .returning();

            await tx
                .update(dossiers)
                .set({
                    status: DossierStatus.PENDING_ARCHIVE,
                    securityLevelId: security.securityLevelId,
                    updatedAt: now,
                })
                .where(eq(dossiers.id, dossierId));

            for (const item of security.fileSecurityLevels) {
                await tx
                    .update(dossierFiles)
                    .set({ securityLevelId: item.securityLevelId })
                    .where(
                        and(
                            eq(dossierFiles.id, item.fileId),
                            eq(dossierFiles.dossierId, dossierId),
                        ),
                    );
            }

            const workflowRow = await insertWorkflowLog(tx, {
                dossierId,
                actorId: userId,
                action: "SUBMIT_ARCHIVE",
                fromStatus: dossier.status,
                toStatus: DossierStatus.PENDING_ARCHIVE,
            });
            workflowAudit = {
                dossierId,
                actorId: userId,
                action: "SUBMIT_ARCHIVE",
                fromStatus: dossier.status,
                toStatus: DossierStatus.PENDING_ARCHIVE,
            };
            workflowLogId = workflowRow.id;

            return submissionRow;
        });

        if (workflowAudit) {
            queueWorkflowAuditFromLog(workflowAudit, workflowLogId);
        }

        return submission;
    },

    async approveSubmission(submissionId: string, reviewerId: string) {
        const submission = await ArchiveSubmissionService.getSubmission(submissionId);
        if (submission.status !== ArchiveSubmissionStatus.PENDING) {
            throw httpError.conflict("Đơn nộp lưu kho không ở trạng thái chờ duyệt");
        }
        assertDossierStatusAllowsArchiveReview(submission.dossierStatus);

        const fondId = resolveFondIdFromSubmission(
            submission.fieldConfigSnapshot,
            submission.fieldValues,
        );
        const dossierTypeId = resolveDossierTypeIdFromSubmission(
            submission.fieldConfigSnapshot,
            submission.fieldValues,
        );
        const now = new Date();

        let workflowAudit: WorkflowLogWriteInput | null = null;
        let workflowLogId: string | null = null;

        const result = await db.transaction(async (tx) => {
            const [updatedSubmission] = await tx
                .update(archiveSubmissions)
                .set({
                    status: ArchiveSubmissionStatus.APPROVED,
                    reviewedBy: reviewerId,
                    reviewedAt: now,
                    updatedAt: now,
                })
                .where(eq(archiveSubmissions.id, submissionId))
                .returning();

            await tx
                .update(dossiers)
                .set({
                    status: DossierStatus.ARCHIVED,
                    ...(fondId ? { fondId } : {}),
                    ...(dossierTypeId ? { dossierTypeId } : {}),
                    updatedAt: now,
                })
                .where(eq(dossiers.id, submission.dossierId));

            const workflowRow = await insertWorkflowLog(tx, {
                dossierId: submission.dossierId,
                actorId: reviewerId,
                action: "APPROVE_ARCHIVE",
                fromStatus: submission.dossierStatus,
                toStatus: DossierStatus.ARCHIVED,
            });
            workflowAudit = {
                dossierId: submission.dossierId,
                actorId: reviewerId,
                action: "APPROVE_ARCHIVE",
                fromStatus: submission.dossierStatus,
                toStatus: DossierStatus.ARCHIVED,
            };
            workflowLogId = workflowRow.id;

            return updatedSubmission;
        });

        if (workflowAudit) {
            queueWorkflowAuditFromLog(workflowAudit, workflowLogId);
        }

        enqueueDossierIndex(submission.dossierId);

        const physicalItemId = submission.fieldValues[PHYSICAL_LOCATION_FIELD_KEY];
        if (typeof physicalItemId === "string" && physicalItemId.trim() !== "") {
            await PlacementService.tryPlaceFromApproval({
                dossierId: submission.dossierId,
                physicalItemId: physicalItemId.trim(),
                placedBy: reviewerId,
                archiveSubmissionId: submissionId,
            });
        }

        return result;
    },

    async rejectSubmission(
        submissionId: string,
        reviewerId: string,
        rejectNotes: string,
    ) {
        const notes = rejectNotes.trim();
        if (!notes) {
            throw httpError.badRequest("Vui lòng nhập lý do từ chối");
        }

        const submission = await ArchiveSubmissionService.getSubmission(submissionId);
        if (submission.status !== ArchiveSubmissionStatus.PENDING) {
            throw httpError.conflict("Đơn nộp lưu kho không ở trạng thái chờ duyệt");
        }
        assertDossierStatusAllowsArchiveReview(submission.dossierStatus);

        const now = new Date();

        let workflowAudit: WorkflowLogWriteInput | null = null;
        let workflowLogId: string | null = null;

        const updatedSubmission = await db.transaction(async (tx) => {
            const [submissionRow] = await tx
                .update(archiveSubmissions)
                .set({
                    status: ArchiveSubmissionStatus.REJECTED,
                    reviewedBy: reviewerId,
                    reviewedAt: now,
                    rejectNotes: notes,
                    updatedAt: now,
                })
                .where(eq(archiveSubmissions.id, submissionId))
                .returning();

            await tx
                .update(dossiers)
                .set({
                    status: DossierStatus.ARCHIVE_REJECTED,
                    updatedAt: now,
                })
                .where(eq(dossiers.id, submission.dossierId));

            const workflowRow = await insertWorkflowLog(tx, {
                dossierId: submission.dossierId,
                actorId: reviewerId,
                action: "REJECT_ARCHIVE",
                fromStatus: submission.dossierStatus,
                toStatus: DossierStatus.ARCHIVE_REJECTED,
                notes,
            });
            workflowAudit = {
                dossierId: submission.dossierId,
                actorId: reviewerId,
                action: "REJECT_ARCHIVE",
                fromStatus: submission.dossierStatus,
                toStatus: DossierStatus.ARCHIVE_REJECTED,
                notes,
            };
            workflowLogId = workflowRow.id;

            return submissionRow;
        });

        if (workflowAudit) {
            queueWorkflowAuditFromLog(workflowAudit, workflowLogId);
        }

        return updatedSubmission;
    },
};

export { SUBMITTABLE_DOSSIER_STATUSES };
