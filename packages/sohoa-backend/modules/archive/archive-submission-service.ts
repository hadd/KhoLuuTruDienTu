import { and, desc, eq, sql } from "drizzle-orm";
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
import { dossiers } from "../../db/schemas/dossier.ts";
import { userProfiles } from "../../db/schemas/user_profile.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
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

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const SUBMITTABLE_DOSSIER_STATUSES = [
    DossierStatus.APPROVED,
    DossierStatus.ARCHIVE_REJECTED,
] as const;

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

async function insertWorkflowLog(
    tx: DbTx,
    input: {
        dossierId: string;
        actorId: string;
        action: string;
        fromStatus: DossierStatusType | null;
        toStatus: DossierStatusType | null;
        notes?: string | null;
    },
) {
    await tx.insert(workflowLogs).values({
        dossierId: input.dossierId,
        actorId: input.actorId,
        action: input.action,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        notes: input.notes ?? null,
    });
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

export const ArchiveSubmissionService = {
    listActiveFieldConfigs() {
        return ArchiveFieldConfigService.listActiveFieldConfigs();
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

    async submitToArchive(
        dossierId: string,
        userId: string,
        fieldValues: ArchiveFieldValueSnapshot,
    ) {
        const dossier = await db.query.dossiers.findFirst({
            where: activeDossierWhere(eq(dossiers.id, dossierId)),
            columns: { id: true, status: true },
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
        const now = new Date();

        return db.transaction(async (tx) => {
            const [submission] = await tx
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
                    updatedAt: now,
                })
                .where(eq(dossiers.id, dossierId));

            await insertWorkflowLog(tx, {
                dossierId,
                actorId: userId,
                action: "SUBMIT_ARCHIVE",
                fromStatus: dossier.status,
                toStatus: DossierStatus.PENDING_ARCHIVE,
            });

            return submission;
        });
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
        const now = new Date();

        return db.transaction(async (tx) => {
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
                    updatedAt: now,
                })
                .where(eq(dossiers.id, submission.dossierId));

            await insertWorkflowLog(tx, {
                dossierId: submission.dossierId,
                actorId: reviewerId,
                action: "APPROVE_ARCHIVE",
                fromStatus: submission.dossierStatus,
                toStatus: DossierStatus.ARCHIVED,
            });

            return updatedSubmission;
        });
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

        return db.transaction(async (tx) => {
            const [updatedSubmission] = await tx
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

            await insertWorkflowLog(tx, {
                dossierId: submission.dossierId,
                actorId: reviewerId,
                action: "REJECT_ARCHIVE",
                fromStatus: submission.dossierStatus,
                toStatus: DossierStatus.ARCHIVE_REJECTED,
                notes,
            });

            return updatedSubmission;
        });
    },
};

export { SUBMITTABLE_DOSSIER_STATUSES };
