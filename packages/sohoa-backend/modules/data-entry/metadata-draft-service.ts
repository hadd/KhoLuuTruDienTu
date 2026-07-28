import { httpError } from "@shared/common-lib";
import { and, eq, inArray } from "drizzle-orm";
import { isActiveDossier } from "../dossier/active-query-filters.ts";
import { db } from "../../db/db-conn.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import {
    AssignmentStatus,
    CHECKER_REJECTED_STATUSES,
    DossierStatus,
    QC_CHECKER_BY_STEP,
    QC_CHECKER_WORKFLOW,
    WORKABLE_ASSIGNMENT_STATUSES,
    WorkerRole,
} from "../../db/schemas/workflow-constants.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
import {
    parseAllowedFields,
    validateWritePermission,
} from "../../libs/metadata-field-filter.ts";
import { parseDossierMetadata } from "../../libs/metadata-normalize.ts";
import { isDossierMetadata } from "../../libs/metadata-types.ts";
import { resolveMakerAllowedFieldsForDossier } from "./maker-slot-metadata-acl.ts";
import { buildDraftMetadataKey } from "./metadata-storage-keys.ts";
import {
    buildLinkGet,
    deleteJsonFromStorage,
    downloadJsonFromStorage,
    resolveMetadataJsonKey,
    uploadJsonToStorage,
} from "./data-entry-s3-utils.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const MAX_DRAFT_DOSSIERS_PER_USER = 10;

const METADATA_EDITOR_ROLES = [
    WorkerRole.MAKER,
    ...QC_CHECKER_WORKFLOW.map((config) => config.role),
] as const;

const MAKER_ENTRY_STATUSES = [
    DossierStatus.ENTRY_PROCESSING,
    DossierStatus.READY_FOR_ENTRY,
    ...CHECKER_REJECTED_STATUSES,
] as const;

export function resolveDossierMetadataBaseKey(input: {
    currentMetadataKey: string | null;
    ocrMetadataKey: string | null;
}): string | null {
    return input.currentMetadataKey ?? input.ocrMetadataKey;
}

export function resolveDossierDraftKey(input: {
    currentMetadataKey: string | null;
    ocrMetadataKey: string | null;
    assignmentId?: string | null;
}): string | null {
    const baseKey = resolveDossierMetadataBaseKey(input);
    if (!baseKey) {
        return null;
    }
    return buildDraftMetadataKey(baseKey, input.assignmentId);
}

export async function deleteDossierDraftMetadata(input: {
    currentMetadataKey: string | null;
    ocrMetadataKey: string | null;
    assignmentId?: string | null;
}): Promise<void> {
    const draftKey = resolveDossierDraftKey(input);
    if (!draftKey) {
        return;
    }

    try {
        await deleteJsonFromStorage(draftKey);
    } catch (err) {
        console.error("[MetadataDraft] Failed to delete draft from storage:", err);
    }
}

/** Xóa file nháp trên MinIO và đưa phân công MAKER đang DRAFT về IN_PROGRESS. */
export async function clearDossierDraftState(
    tx: DbTx,
    input: {
        dossierId: string;
        currentMetadataKey: string | null;
        ocrMetadataKey: string | null;
    },
): Promise<void> {
    const draftAssignments = await tx.query.dossierAssignments.findMany({
        where: and(
            eq(dossierAssignments.dossierId, input.dossierId),
            eq(dossierAssignments.role, WorkerRole.MAKER),
            eq(dossierAssignments.status, AssignmentStatus.DRAFT),
        ),
        columns: { id: true },
    });

    for (const assignment of draftAssignments) {
        await deleteDossierDraftMetadata({
            currentMetadataKey: input.currentMetadataKey,
            ocrMetadataKey: input.ocrMetadataKey,
            assignmentId: assignment.id,
        });
    }

    await deleteDossierDraftMetadata({
        currentMetadataKey: input.currentMetadataKey,
        ocrMetadataKey: input.ocrMetadataKey,
    });

    await tx
        .update(dossierAssignments)
        .set({
            status: AssignmentStatus.IN_PROGRESS,
            completedAt: null,
        })
        .where(and(
            eq(dossierAssignments.dossierId, input.dossierId),
            eq(dossierAssignments.role, WorkerRole.MAKER),
            eq(dossierAssignments.status, AssignmentStatus.DRAFT),
        ));
}

async function countUserActiveDraftAssignments(assigneeId: string): Promise<number> {
    const rows = await db.query.dossierAssignments.findMany({
        where: and(
            eq(dossierAssignments.assigneeId, assigneeId),
            eq(dossierAssignments.status, AssignmentStatus.DRAFT),
            inArray(dossierAssignments.role, [...METADATA_EDITOR_ROLES]),
        ),
        with: {
            dossier: {
                columns: {
                    id: true,
                    deletedAt: true,
                },
            },
        },
    });

    return rows.filter((row) => isActiveDossier(row.dossier)).length;
}

async function resolveWorkableMetadataAssignment(dossierId: string, actorId: string) {
    const rows = await db.query.dossierAssignments.findMany({
        where: and(
            eq(dossierAssignments.dossierId, dossierId),
            eq(dossierAssignments.assigneeId, actorId),
            inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
            inArray(dossierAssignments.role, [...METADATA_EDITOR_ROLES]),
        ),
        with: { dossier: true },
    });

    const assignments = rows.filter((row) => isActiveDossier(row.dossier));
    if (assignments.length === 0) {
        throw httpError.notFound("No workable assignment found for this dossier");
    }
    if (assignments.length === 1) {
        return assignments[0]!;
    }

    const dossier = assignments[0]!.dossier;
    const maker = assignments.find((row) => row.role === WorkerRole.MAKER);
    if (maker && (MAKER_ENTRY_STATUSES as readonly string[]).includes(dossier.status)) {
        return maker;
    }

    const expectedChecker = QC_CHECKER_BY_STEP.get(dossier.currentQcStep + 1);
    if (expectedChecker) {
        const checker = assignments.find((row) => row.role === expectedChecker.role);
        if (checker) {
            return checker;
        }
    }

    throw httpError.conflict(
        "Multiple workable assignments found; cannot determine metadata editor role",
    );
}

function validateMakerDraftWritePermission(
    metadata: unknown,
    allowedFields: string[] | null,
): void {
    if (allowedFields === null) {
        return;
    }

    if (!isDossierMetadata(metadata)) {
        throw httpError.badRequest("Invalid metadata format");
    }

    const { allowed, violations } = validateWritePermission(metadata, allowedFields);
    if (!allowed) {
        throw httpError.forbidden(
            `Field write permission denied for: ${violations.join(", ")}`,
        );
    }
}

async function insertDraftWorkflowLog(
    tx: DbTx,
    input: {
        dossierId: string;
        actorId: string;
        dossierStatus: string;
    },
) {
    await tx.insert(workflowLogs).values({
        dossierId: input.dossierId,
        actorId: input.actorId,
        action: "SAVE_DRAFT",
        fromStatus: input.dossierStatus,
        toStatus: input.dossierStatus,
    });
}

/** Lưu nháp metadata theo từng phân công để editor/QC không ghi đè hoặc xóa nháp của nhau. */
export async function saveMetadataDraft(input: {
    dossierId: string;
    actorId: string;
    metadata: unknown;
}) {
    const assignment = await resolveWorkableMetadataAssignment(
        input.dossierId,
        input.actorId,
    );
    const dossier = assignment.dossier;

    if (!dossier.ocrMetadataKey) {
        throw httpError.badRequest("Dossier has no OCR metadata key");
    }

    if (assignment.role === WorkerRole.MAKER) {
        const ocrJsonKey = resolveMetadataJsonKey(dossier.ocrMetadataKey);
        const rawOcrMetadata = await downloadJsonFromStorage(ocrJsonKey);
        const dossierCatalog = parseDossierMetadata(rawOcrMetadata);
        const allowedFields = await resolveMakerAllowedFieldsForDossier({
            assigneeId: input.actorId,
            storedAllowedFieldsJson: assignment.allowedFields,
            dossierMetadata: dossierCatalog,
        });
        validateMakerDraftWritePermission(input.metadata, allowedFields);
    }

    const isUpdatingExistingDraft = assignment.status === AssignmentStatus.DRAFT;
    if (!isUpdatingExistingDraft) {
        const draftCount = await countUserActiveDraftAssignments(input.actorId);
        if (draftCount >= MAX_DRAFT_DOSSIERS_PER_USER) {
            throw httpError.conflict(
                `Maximum ${MAX_DRAFT_DOSSIERS_PER_USER} draft dossiers allowed per user`,
            );
        }
    }

    const draftKey = resolveDossierDraftKey({
        currentMetadataKey: dossier.currentMetadataKey,
        ocrMetadataKey: dossier.ocrMetadataKey,
        assignmentId: assignment.id,
    });
    if (!draftKey) {
        throw httpError.badRequest("Cannot resolve draft metadata key for dossier");
    }

    const storedKey = await uploadJsonToStorage(draftKey, input.metadata);

    const now = new Date();

    await db.transaction(async (tx) => {
        const [assignmentRow] = await tx
            .update(dossierAssignments)
            .set({
                status: AssignmentStatus.DRAFT,
                completedAt: null,
            })
            .where(and(
                eq(dossierAssignments.id, assignment.id),
                inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
            ))
            .returning();

        if (!assignmentRow) {
            throw httpError.conflict("Assignment is no longer workable");
        }

        await insertDraftWorkflowLog(tx, {
            dossierId: input.dossierId,
            actorId: input.actorId,
            dossierStatus: dossier.status,
        });
    });

    const draftMetadataUrl = await buildLinkGet(storedKey);

    return {
        dossierId: input.dossierId,
        assignmentId: assignment.id,
        draftMetadataKey: storedKey,
        draftMetadataUrl,
        assignmentStatus: AssignmentStatus.DRAFT,
        dossierStatus: dossier.status,
        savedAt: now.toISOString(),
    };
}

export function resolveMetadataKeyForWorkableAssignment(input: {
    status: string;
    assignmentId?: string | null;
    currentMetadataKey: string | null;
    ocrMetadataKey: string | null;
}): string | null {
    if (input.status === AssignmentStatus.DRAFT) {
        const draftKey = resolveDossierDraftKey({
            currentMetadataKey: input.currentMetadataKey,
            ocrMetadataKey: input.ocrMetadataKey,
            assignmentId: input.assignmentId,
        });
        if (draftKey) {
            return draftKey;
        }
    }

    return resolveDossierMetadataBaseKey(input);
}

export async function findWorkableEditorAssignment(
    dossierId: string,
    actorId: string,
) {
    return await db.query.dossierAssignments.findFirst({
        where: and(
            eq(dossierAssignments.dossierId, dossierId),
            eq(dossierAssignments.assigneeId, actorId),
            inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
            inArray(dossierAssignments.role, [...METADATA_EDITOR_ROLES]),
        ),
        columns: {
            id: true,
            status: true,
            role: true,
        },
    });
}

export function resolveMetadataKeyForDossierEditor(input: {
    assignmentId?: string | null;
    assignmentStatus: string | null;
    currentMetadataKey: string | null;
    ocrMetadataKey: string | null;
}): string | null {
    if (input.assignmentStatus) {
        return resolveMetadataKeyForWorkableAssignment({
            status: input.assignmentStatus,
            assignmentId: input.assignmentId,
            currentMetadataKey: input.currentMetadataKey,
            ocrMetadataKey: input.ocrMetadataKey,
        });
    }

    return resolveDossierMetadataBaseKey({
        currentMetadataKey: input.currentMetadataKey,
        ocrMetadataKey: input.ocrMetadataKey,
    });
}
