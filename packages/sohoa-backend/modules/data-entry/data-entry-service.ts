import { httpError } from "@shared/common-lib";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { activeDossierWhere, isActiveDossier } from "../dossier/active-query-filters.ts";
import { toSearchablePdfKey } from "../dossier/dossier-path-utils.ts";
import { db } from "../../db/db-conn.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import { dossierFiles } from "../../db/schemas/dossier-file.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import {
    AssignmentStatus,
    CHECKER_REJECTED_STATUSES,
    DossierStatus,
    QC_CHECKER_WORKFLOW,
    WORKABLE_ASSIGNMENT_STATUSES,
    WorkerRole,
    WorkQuality,
    type AssignmentStatus as AssignmentStatusType,
    type DossierStatus as DossierStatusType,
    type QcCheckerWorkflowStep,
    type WorkerRole as WorkerRoleType,
} from "../../db/schemas/workflow-constants.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
import {
    scheduleDossierApprovedNotification,
    scheduleDossierAssignedNotification,
    scheduleQcStepCompletedNotification,
} from "../notification/notification-delivery-service.ts";
import {
    reopenRejectedCheckerAssignment,
    getCurrentAttemptNumber,
} from "../../libs/workflow-assignment-utils.ts";
import {
    buildLinkGet,
    buildCuratedMetadataUpdateKey,
    downloadJsonFromStorage,
    resolveMetadataJsonKey,
    uploadJsonToStorage,
} from "./data-entry-s3-utils.ts";
import {
    filterMetadataByAllowedFields,
    filterRejectFieldsForAssignment,
    canonicalizeMetadataFieldKeys,
    parseAllowedFields,
    parseRejectFields,
    serializeRejectFields,
    shouldResetMakerOnReject,
} from "../../libs/metadata-field-filter.ts";
import { isDossierMetadata, type DossierMetadata } from "../../libs/metadata-types.ts";
import { hasHoSoFondField } from "../../libs/metadata-normalize.ts";
import {
    resolveEditorSlotFieldPatterns,
    resolveEffectiveAllowedFields,
} from "./maker-slot-metadata-acl.ts";
import {
    enrichMetadataGroupNamesFromCatalog,
    syncDocumentTypesFromOcrMetadata,
} from "../../libs/document-type-sync.ts";
import { recordSnapshot } from "../metadata-history/metadata-history-service.ts";
import { computeFieldDiff } from "../metadata-history/metadata-history-diff.ts";
import {
    markAssignmentsIncorrectOnCheckerEdit,
    markAssignmentsIncorrectOnReject,
} from "../../libs/assignment-work-quality.ts";
import { generateAndPersistAip } from "../../libs/archival-package/aip-service.ts";
import {
    clearDossierDraftState,
    deleteDossierDraftMetadata,
    resolveMetadataKeyForWorkableAssignment,
} from "./metadata-draft-service.ts";
import {
    assertDossierStatusAllowsCheckerAction,
    assertMakerEntryComplete,
    cancelStaleDraftAssignmentsOnDossier,
    loadMakerCompletionState,
} from "../../libs/dossier-workflow-guards.ts";
import type { ClaimResponse } from "./types.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const WORKFLOW_ACTION = {
    CLAIM_ENTRY: "CLAIM_ENTRY",
    SUBMIT_ENTRY: "SUBMIT_ENTRY",
} as const;

const QC_CHECKER_BY_ROLE = new Map<WorkerRoleType, QcCheckerWorkflowStep>(
    QC_CHECKER_WORKFLOW.map((config) => [config.role, config]),
);

const QC_CHECKER_BY_STEP = new Map<number, QcCheckerWorkflowStep>(
    QC_CHECKER_WORKFLOW.map((config) => [config.step, config]),
);

function checkerWorkflowAction(prefix: "CLAIM" | "APPROVE" | "REJECT", step: number): string {
    return `${prefix}_CHECKER_${step}`;
}

function getCheckerConfig(role: WorkerRoleType): QcCheckerWorkflowStep {
    const config = QC_CHECKER_BY_ROLE.get(role);
    if (!config) {
        throw httpError.badRequest("Role cannot perform QC on metadata");
    }
    return config;
}

function getCheckerConfigForCurrentQcStep(currentQcStep: number): QcCheckerWorkflowStep {
    const config = QC_CHECKER_BY_STEP.get(currentQcStep + 1);
    if (!config) {
        return QC_CHECKER_BY_STEP.get(1)!;
    }
    return config;
}

function getWaitingStatusAfterQcStep(completedQcStep: number): DossierStatusType | null {
    const nextChecker = QC_CHECKER_BY_STEP.get(completedQcStep + 1);
    return nextChecker?.waiting ?? null;
}

function resolveNextAfterQcApprove(dossier: {
    currentQcStep: number;
    requiredQcCount: number;
}): { nextQcStep: number; nextStatus: DossierStatusType } {
    const nextQcStep = dossier.currentQcStep + 1;

    if (nextQcStep >= dossier.requiredQcCount) {
        return { nextQcStep, nextStatus: DossierStatus.APPROVED };
    }

    const nextStatus = getWaitingStatusAfterQcStep(nextQcStep);
    if (!nextStatus) {
        throw httpError.internal(
            `No dossier status configured for QC step ${nextQcStep}`,
        );
    }

    return { nextQcStep, nextStatus };
}

const makerGetPriority = sql`CASE
    WHEN ${dossiers.status} = ${DossierStatus.ENTRY_PROCESSING} THEN 0
    WHEN ${inArray(dossiers.status, CHECKER_REJECTED_STATUSES)} THEN 1
    WHEN ${dossiers.status} = ${DossierStatus.READY_FOR_ENTRY} THEN 2
    ELSE 3
END`;

async function insertWorkflowLog(
    tx: DbTx,
    input: {
        dossierId: string;
        actorId: string;
        action: string;
        fromStatus: DossierStatus | null;
        toStatus: DossierStatus | null;
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

function isMakerDossierReturned(input: {
    rejectCount: number;
    rejectFields: string[] | null;
}): boolean {
    return input.rejectCount > 0
        || (input.rejectFields !== null && input.rejectFields.length > 0);
}

async function loadMakerMetadataForAssignment(
    dossier: {
        ocrMetadataKey: string | null;
        currentMetadataKey: string | null;
    },
    assignment: {
        id: string;
        status: string;
        metadataKey: string | null;
        assigneeId?: string;
    },
    storedAllowedFields: string[] | null,
): Promise<{
    currentMetadata: DossierMetadata | null;
    currentMetadataUrl: string | null;
    allowedFields: string[] | null;
}> {
    const rawMetadataKey = resolveMetadataKeyForWorkableAssignment({
        status: assignment.status,
        assignmentId: assignment.id,
        currentMetadataKey: dossier.currentMetadataKey,
        ocrMetadataKey: dossier.ocrMetadataKey,
    });

    if (storedAllowedFields === null) {
        const metadataKeyJson = rawMetadataKey && !rawMetadataKey.endsWith(".json")
            ? `${rawMetadataKey}.json`
            : rawMetadataKey;
        const currentMetadataUrl = await buildLinkGet(metadataKeyJson);
        return {
            currentMetadata: null,
            currentMetadataUrl,
            allowedFields: null,
        };
    }

    if (!rawMetadataKey) {
        return {
            currentMetadata: null,
            currentMetadataUrl: null,
            allowedFields: storedAllowedFields,
        };
    }

    try {
        const jsonKey = resolveMetadataJsonKey(rawMetadataKey);
        const rawMetadata = await downloadJsonFromStorage(jsonKey);
        if (!isDossierMetadata(rawMetadata)) {
            return {
                currentMetadata: null,
                currentMetadataUrl: null,
                allowedFields: storedAllowedFields,
            };
        }

        const enriched = await enrichMetadataGroupNamesFromCatalog(rawMetadata);

        let effectiveAllowedFields = storedAllowedFields;
        if (assignment.assigneeId) {
            const slotPatterns = await resolveEditorSlotFieldPatterns(
                assignment.assigneeId,
            );
            effectiveAllowedFields = resolveEffectiveAllowedFields(
                storedAllowedFields,
                slotPatterns,
                enriched,
            ) ?? storedAllowedFields;
        }

        const filtered = filterMetadataByAllowedFields(
            enriched,
            effectiveAllowedFields,
        );

        const hasVisibleGroups = filtered.metadata_groups.some(
            (group) => (group.fields?.length ?? 0) > 0,
        );

        if (!hasVisibleGroups) {
            const metadataKeyJson = rawMetadataKey && !rawMetadataKey.endsWith(".json")
                ? `${rawMetadataKey}.json`
                : rawMetadataKey;
            const currentMetadataUrl = await buildLinkGet(metadataKeyJson);
            return {
                currentMetadata: null,
                currentMetadataUrl,
                allowedFields: effectiveAllowedFields,
            };
        }

        return {
            currentMetadata: filtered,
            currentMetadataUrl: null,
            allowedFields: effectiveAllowedFields,
        };
    } catch (error) {
        console.error(
            "[loadMakerMetadataForAssignment] failed",
            {
                assignmentId: assignment.id,
                rawMetadataKey,
                allowedFieldsSample: storedAllowedFields.slice(0, 5),
            },
            error,
        );
        return {
            currentMetadata: null,
            currentMetadataUrl: null,
            allowedFields: storedAllowedFields,
        };
    }
}

async function buildClaimPayload(
    assignment: {
        id: string;
        dossierId: string;
        assigneeId: string;
        role: WorkerRoleType;
        attemptNumber: number;
        status: string;
        metadataKey?: string | null;
        workQuality?: string | null;
        allowedFields?: string | null;
        rejectFields?: string | null;
    },
    dossier: {
        id: string;
        name: string;
        status: DossierStatusType;
        ocrMetadataKey: string | null;
        currentMetadataKey: string | null;
        rejectCount?: number;
        lastRejectNotes?: string | null;
        currentQcStep?: number;
    },
): Promise<ClaimResponse> {
    const files = await db.query.dossierFiles.findMany({
        where: eq(dossierFiles.dossierId, dossier.id),
        orderBy: asc(dossierFiles.fileName),
    });

    const filesWithUrls = await Promise.all(
        files.map(async (file) => {
            const searchablePdfPath = toSearchablePdfKey(file.filePath);
            return {
                id: file.id,
                fileName: file.fileName,
                fileUrl: (await buildLinkGet(file.filePath)) ?? "",
                searchablePdfPath,
                searchablePdfUrl: searchablePdfPath
                    ? (await buildLinkGet(searchablePdfPath)) ?? ""
                    : null,
            };
        }),
    );

    const allowedFields = parseAllowedFields(assignment.allowedFields);
    const rejectFields = parseRejectFields(assignment.rejectFields);
    const metadataPayload = await loadMakerMetadataForAssignment(
        dossier,
        {
            id: assignment.id,
            status: assignment.status,
            metadataKey: assignment.metadataKey ?? null,
            assigneeId: assignment.assigneeId,
        },
        allowedFields,
    );

    const rejectCount = dossier.rejectCount ?? 0;
    const isReturned = assignment.role === WorkerRole.MAKER
        && isMakerDossierReturned({
            rejectCount,
            rejectFields,
        });

    const dossierPayload: ClaimResponse["dossier"] = {
        id: dossier.id,
        name: dossier.name,
        status: dossier.status,
        ocrMetadataKey: dossier.ocrMetadataKey,
        ...(assignment.role === WorkerRole.MAKER
            ? {
                rejectCount,
                lastRejectNotes: dossier.lastRejectNotes ?? null,
                isReturned,
                rejectedQcStep: isReturned && dossier.currentQcStep !== undefined
                    ? dossier.currentQcStep + 1
                    : null,
            }
            : {}),
    };

    return {
        assignment: {
            id: assignment.id,
            dossierId: assignment.dossierId,
            role: assignment.role,
            attemptNumber: assignment.attemptNumber,
            status: assignment.status as any,
            workQuality: (assignment.workQuality ?? null) as any,
        },
        dossier: dossierPayload,
        files: filesWithUrls,
        currentMetadataUrl: metadataPayload.currentMetadataUrl,
        currentMetadata: metadataPayload.currentMetadata,
        allowedFields: metadataPayload.allowedFields,
        rejectFields,
        ...(assignment.role === WorkerRole.MAKER
            ? {
                issueReport: await (async () => {
                    const { IssueReportService } = await import(
                        "../issue-report/issue-report-service.ts"
                    );
                    return await IssueReportService.getLatestForAssignment(assignment.id);
                })(),
            }
            : {
                issueReports: await (async () => {
                    const { IssueReportService } = await import(
                        "../issue-report/issue-report-service.ts"
                    );
                    return await IssueReportService.listOpenForDossier(dossier.id);
                })(),
            }),
    };
}

async function findActiveAssignment(assigneeId: string, role: WorkerRoleType) {
    return await db.query.dossierAssignments.findFirst({
        where: and(
            eq(dossierAssignments.assigneeId, assigneeId),
            eq(dossierAssignments.role, role),
            inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
        ),
        with: { dossier: true },
        orderBy: asc(dossierAssignments.assignedAt),
    });
}

async function claimDossier(input: {
    role: WorkerRoleType;
    assigneeId: string;
    allowedStatuses: DossierStatus[];
    processingStatus: DossierStatus;
    priorityOrder?: ReturnType<typeof sql>;
    workflowAction: string;
}) {
    const existing = await findActiveAssignment(input.assigneeId, input.role);
    if (isActiveDossier(existing?.dossier)) {
        return await buildClaimPayload(existing!, existing.dossier);
    }

    const result = await db.transaction(async (tx) => {
        const orderBy = input.priorityOrder
            ? [input.priorityOrder, asc(dossiers.updatedAt)]
            : [asc(dossiers.updatedAt)];

        const [candidate] = await tx
            .select()
            .from(dossiers)
            .where(activeDossierWhere(inArray(dossiers.status, input.allowedStatuses)))
            .orderBy(...orderBy)
            .limit(1)
            .for("update", { skipLocked: true });

        if (!candidate) {
            return null;
        }

        const [updated] = await tx
            .update(dossiers)
            .set({
                status: input.processingStatus,
                updatedAt: new Date(),
            })
            .where(activeDossierWhere(
                eq(dossiers.id, candidate.id),
                inArray(dossiers.status, input.allowedStatuses),
            ))
            .returning();

        if (!updated) {
            return null;
        }

        const attemptNumber = await getCurrentAttemptNumber(tx, updated.id, input.role);

        const [assignment] = await tx
            .insert(dossierAssignments)
            .values({
                dossierId: updated.id,
                role: input.role,
                assigneeId: input.assigneeId,
                attemptNumber,
                stepNumber: updated.currentQcStep + 1,
                status: AssignmentStatus.IN_PROGRESS,
            })
            .returning();

        await insertWorkflowLog(tx, {
            dossierId: updated.id,
            actorId: input.assigneeId,
            action: input.workflowAction,
            fromStatus: candidate.status,
            toStatus: input.processingStatus,
        });

        return { assignment, dossier: updated };
    });

    if (!result) {
        throw httpError.notFound("No dossier available to claim");
    }

    scheduleDossierAssignedNotification({
        dossierId: result.dossier.id,
        assigneeId: result.assignment.assigneeId,
        workerRole: input.role,
        dossierName: result.dossier.name,
        folderId: result.dossier.folderId,
    });

    return await buildClaimPayload(result.assignment, result.dossier);
}

async function loadWorkableAssignmentForRoleByDossier(
    dossierId: string,
    role: WorkerRoleType,
) {
    const assignment = await db.query.dossierAssignments.findFirst({
        where: and(
            eq(dossierAssignments.dossierId, dossierId),
            eq(dossierAssignments.role, role),
            inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
        ),
        with: { dossier: true },
    });

    if (!isActiveDossier(assignment?.dossier)) {
        throw httpError.notFound("No workable checker assignment found for this dossier");
    }

    return assignment;
}

async function loadAssignmentForActorByDossier(
    dossierId: string,
    actorId: string,
    role: WorkerRoleType,
) {
    const assignment = await db.query.dossierAssignments.findFirst({
        where: and(
            eq(dossierAssignments.dossierId, dossierId),
            eq(dossierAssignments.assigneeId, actorId),
            eq(dossierAssignments.role, role),
            inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
        ),
        with: { dossier: true },
    });

    if (!isActiveDossier(assignment?.dossier)) {
        throw httpError.notFound("No workable assignment found for this dossier");
    }

    return assignment;
}

async function directApproveDossier(
    dossierId: string,
    actorId: string,
    metadata?: unknown,
) {
    const dossier = await db.query.dossiers.findFirst({
        where: activeDossierWhere(eq(dossiers.id, dossierId)),
    });

    if (!isActiveDossier(dossier)) {
        throw httpError.notFound("Dossier not found or inactive");
    }

    if (dossier.status === DossierStatus.APPROVED || dossier.status === DossierStatus.ARCHIVED) {
        throw httpError.conflict("Dossier is already approved or archived");
    }

    let storedKey = dossier.currentMetadataKey ?? dossier.ocrMetadataKey;

    if (metadata) {
        const metadataKey = buildCuratedMetadataUpdateKey(
            dossier.ocrMetadataKey ?? "metadata/curated",
            WorkerRole.CHECKER_1,
            1,
        );
        storedKey = await uploadJsonToStorage(metadataKey, metadata);

        const { syncDossierFondIdFromMetadata } = await import(
            "../dossier/dossier-fond-sync.ts"
        );
        const syncedFondId = await syncDossierFondIdFromMetadata(dossierId, metadata);
        const effectiveFondId = syncedFondId || dossier.fondId;

        try {
            await syncDocumentTypesFromOcrMetadata(dossierId, metadata);
        } catch (err) {
            console.error("[DataEntry] Failed to sync document types on direct approve:", err);
        }
    } else {
        let currentMeta: unknown = null;
        if (storedKey) {
            try {
                currentMeta = await downloadJsonFromStorage(resolveMetadataJsonKey(storedKey));
            } catch {
                currentMeta = null;
            }
        }
    }

    const now = new Date();

    const updatedDossier = await db.transaction(async (tx) => {
        const [dossierRow] = await tx
            .update(dossiers)
            .set({
                status: DossierStatus.APPROVED,
                currentQcStep: dossier.requiredQcCount,
                currentMetadataKey: storedKey,
                updatedAt: now,
            })
            .where(activeDossierWhere(eq(dossiers.id, dossier.id)))
            .returning();

        if (!dossierRow) {
            throw httpError.notFound("Dossier not found");
        }

        const { IssueReportService } = await import("../issue-report/issue-report-service.ts");
        await IssueReportService.closeConfirmedOnCheckerApprove(tx, dossierId);
        await cancelStaleDraftAssignmentsOnDossier(tx, dossierId, now);

        await insertWorkflowLog(tx, {
            dossierId: dossier.id,
            actorId: actorId,
            action: WORKFLOW_ACTION.DIRECT_APPROVE ?? "DIRECT_APPROVE",
            fromStatus: dossier.status,
            toStatus: DossierStatus.APPROVED,
        });

        return dossierRow;
    });

    recordSnapshot({
        dossierId: dossier.id,
        actorId,
        role: WorkerRole.CHECKER_1,
        action: "DIRECT_APPROVE",
        fromStatus: dossier.status,
        toStatus: DossierStatus.APPROVED,
        s3Key: storedKey ?? "",
        previousS3Key: dossier.currentMetadataKey ?? dossier.ocrMetadataKey,
    }).catch((err) => {
        console.error("[MetadataHistory] Failed to record direct approve snapshot:", err);
    });

    generateAndPersistAip({ dossierId: dossier.id }).catch((err) => {
        console.error("[AIP] Failed to generate archival package:", err);
    });

    scheduleDossierApprovedNotification({
        dossierId: dossier.id,
        dossierName: dossier.name,
        folderId: dossier.folderId,
    });

    return {
        dossierId: dossier.id,
        assignmentId: null,
        metadataKey: storedKey ?? "",
        dossierStatus: updatedDossier.status,
        currentQcStep: updatedDossier.currentQcStep,
        approvedQcStep: dossier.requiredQcCount,
    };
}

async function approveMetadata(input: {
    dossierId: string;
    actorId: string;
    role: WorkerRoleType;
    metadata: unknown;
    workflowAction?: string;
}) {
    const assignment = await loadAssignmentForActorByDossier(
        input.dossierId,
        input.actorId,
        input.role,
    );

    const dossier = assignment.dossier;
    const checkerConfig = getCheckerConfig(input.role);

    if (dossier.currentQcStep + 1 !== checkerConfig.step) {
        throw httpError.conflict(
            `Dossier is at QC step ${dossier.currentQcStep}, cannot approve as ${input.role}`,
        );
    }

    assertDossierStatusAllowsCheckerAction(dossier.status, checkerConfig);

    const makerState = await loadMakerCompletionState(db, input.dossierId);
    assertMakerEntryComplete(makerState);

    if (!dossier.ocrMetadataKey) {
        throw httpError.badRequest("Dossier has no OCR metadata key");
    }

    const { nextQcStep, nextStatus } = resolveNextAfterQcApprove(dossier);
    const workflowAction = input.workflowAction
        ?? checkerWorkflowAction("APPROVE", checkerConfig.step);

    const metadataKey = buildCuratedMetadataUpdateKey(
        dossier.ocrMetadataKey,
        input.role,
        assignment.attemptNumber,
    );
    const previousMetadataKey = dossier.currentMetadataKey ?? dossier.ocrMetadataKey;
    await deleteDossierDraftMetadata({
        currentMetadataKey: dossier.currentMetadataKey,
        ocrMetadataKey: dossier.ocrMetadataKey,
        assignmentId: assignment.id,
    });
    const storedKey = await uploadJsonToStorage(metadataKey, input.metadata);

    const { syncDossierFondIdFromMetadata } = await import(
        "../dossier/dossier-fond-sync.ts"
    );
    const syncedFondId = await syncDossierFondIdFromMetadata(input.dossierId, input.metadata);
    const effectiveFondId = syncedFondId || dossier.fondId;

    // Đồng bộ catalog loại tài liệu từ metadata đã duyệt (group_code/group_name).
    try {
        await syncDocumentTypesFromOcrMetadata(input.dossierId, input.metadata);
    } catch (err) {
        console.error("[DataEntry] Failed to sync document types on QC approve:", err);
    }

    let changedFieldKeys: string[] = [];
    if (isDossierMetadata(input.metadata) && previousMetadataKey) {
        try {
            const oldRaw = await downloadJsonFromStorage(
                resolveMetadataJsonKey(previousMetadataKey),
            );
            if (isDossierMetadata(oldRaw)) {
                const diff = computeFieldDiff(oldRaw, input.metadata);
                if (diff) {
                    changedFieldKeys = canonicalizeMetadataFieldKeys(Object.keys(diff));
                }
            }
        } catch (err) {
            console.error("[DataEntry] Failed to diff metadata on checker approve:", err);
        }
    }

    const now = new Date();

    const updatedDossier = await db.transaction(async (tx) => {
        const [assignmentRow] = await tx
            .update(dossierAssignments)
            .set({
                metadataKey: storedKey,
                status: AssignmentStatus.COMPLETED,
                workQuality: assignment.workQuality === WorkQuality.INCORRECT
                    ? WorkQuality.INCORRECT
                    : WorkQuality.CORRECT,
                completedAt: now,
            })
            .where(and(
                eq(dossierAssignments.id, assignment.id),
                inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
            ))
            .returning();

        if (!assignmentRow) {
            throw httpError.conflict("Assignment is no longer in progress");
        }

        const [dossierRow] = await tx
            .update(dossiers)
            .set({
                status: nextStatus,
                currentQcStep: nextQcStep,
                currentMetadataKey: storedKey,
                updatedAt: now,
            })
            .where(activeDossierWhere(eq(dossiers.id, dossier.id)))
            .returning();

        if (!dossierRow) {
            throw httpError.notFound("Dossier not found");
        }

        const { IssueReportService } = await import("../issue-report/issue-report-service.ts");
        const waivedAssignmentIds = checkerConfig.step === 1
            ? await IssueReportService.getConfirmedWaivedAssignmentIds(tx, input.dossierId)
            : undefined;

        await markAssignmentsIncorrectOnCheckerEdit(tx, {
            dossierId: input.dossierId,
            checkerStep: checkerConfig.step,
            changedFieldKeys,
            waivedAssignmentIds,
        });

        await IssueReportService.closeConfirmedOnCheckerApprove(tx, input.dossierId);

        await cancelStaleDraftAssignmentsOnDossier(tx, input.dossierId, now);

        // If the next checker was previously REJECTED (from a prior reject cycle),
        // reset their assignment to IN_PROGRESS so they can act again.
        const nextCheckerConfig = QC_CHECKER_BY_STEP.get(checkerConfig.step + 1);
        if (nextCheckerConfig && nextStatus !== DossierStatus.APPROVED) {
            await reopenRejectedCheckerAssignment(tx, {
                dossierId: input.dossierId,
                role: nextCheckerConfig.role,
                now,
            });
        }

        await insertWorkflowLog(tx, {
            dossierId: dossier.id,
            actorId: input.actorId,
            action: workflowAction,
            fromStatus: dossier.status,
            toStatus: nextStatus,
        });

        return dossierRow;
    });

    // Record metadata history snapshot (best-effort, non-blocking).
    recordSnapshot({
        dossierId: dossier.id,
        actorId: input.actorId,
        role: input.role,
        action: workflowAction,
        fromStatus: dossier.status,
        toStatus: nextStatus,
        s3Key: storedKey,
        previousS3Key: previousMetadataKey,
    }).catch((err) => {
        console.error("[MetadataHistory] Failed to record checker snapshot:", err);
    });

    if (nextStatus === DossierStatus.APPROVED) {
        generateAndPersistAip({ dossierId: dossier.id }).catch((err) => {
            console.error("[AIP] Failed to generate archival package:", err);
        });
        scheduleDossierApprovedNotification({
            dossierId: dossier.id,
            dossierName: dossier.name,
            folderId: dossier.folderId,
        });
    } else {
        const nextCheckerConfig = QC_CHECKER_BY_STEP.get(checkerConfig.step + 1);
        if (nextCheckerConfig) {
            scheduleQcStepCompletedNotification({
                dossierId: dossier.id,
                dossierName: dossier.name,
                folderId: dossier.folderId,
                completedQcStep: checkerConfig.step,
                nextQcStep: nextCheckerConfig.step,
            });
        }
    }

    return {
        dossierId: dossier.id,
        assignmentId: assignment.id,
        metadataKey: storedKey,
        dossierStatus: updatedDossier.status,
        currentQcStep: updatedDossier.currentQcStep,
        approvedQcStep: checkerConfig.step,
    };
}

async function rejectMetadata(input: {
    dossierId: string;
    actorId: string;
    role: WorkerRoleType;
    notes: string;
    rejectFields?: string[] | null;
    workflowAction?: string;
    assignmentResolver?: "actor" | "role";
}) {
    const assignment = input.assignmentResolver === "role"
        ? await loadWorkableAssignmentForRoleByDossier(input.dossierId, input.role)
        : await loadAssignmentForActorByDossier(
            input.dossierId,
            input.actorId,
            input.role,
        );

    const dossier = assignment.dossier;
    const checkerConfig = getCheckerConfig(input.role);

    if (dossier.currentQcStep + 1 !== checkerConfig.step) {
        throw httpError.conflict(
            `Dossier is at QC step ${dossier.currentQcStep}, cannot reject as ${input.role}`,
        );
    }

    assertDossierStatusAllowsCheckerAction(dossier.status, checkerConfig);

    const makerState = await loadMakerCompletionState(db, input.dossierId);
    assertMakerEntryComplete(makerState);

    const selectiveReject = input.rejectFields != null && input.rejectFields.length > 0;
    if (selectiveReject) {
        for (const field of input.rejectFields!) {
            if (!field.includes(".") && !field.endsWith(".*")) {
                throw httpError.badRequest(
                    `Invalid reject field "${field}": expected GROUP.FIELD or GROUP.*`,
                );
            }
        }
    }

    const workflowAction = input.workflowAction
        ?? checkerWorkflowAction("REJECT", checkerConfig.step);

    const checkerRolesToReset: WorkerRoleType[] = QC_CHECKER_WORKFLOW
        .filter((c) => c.step < checkerConfig.step)
        .map((c) => c.role);

    const now = new Date();
    let reopenedMakerCount = 0;

    const updatedDossier = await db.transaction(async (tx) => {
        const [assignmentRow] = await tx
            .update(dossierAssignments)
            .set({
                status: AssignmentStatus.REJECTED,
                completedAt: now,
            })
            .where(and(
                eq(dossierAssignments.id, assignment.id),
                inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
            ))
            .returning();

        if (!assignmentRow) {
            throw httpError.conflict("Assignment is no longer in progress");
        }

        await clearDossierDraftState(tx, {
            dossierId: input.dossierId,
            currentMetadataKey: dossier.currentMetadataKey,
            ocrMetadataKey: dossier.ocrMetadataKey,
        });

        await markAssignmentsIncorrectOnReject(tx, {
            dossierId: input.dossierId,
            rejectingCheckerStep: checkerConfig.step,
            rejectFields: selectiveReject ? input.rejectFields! : null,
        });

        const completedMakers = await tx.query.dossierAssignments.findMany({
            where: and(
                eq(dossierAssignments.dossierId, input.dossierId),
                eq(dossierAssignments.role, WorkerRole.MAKER),
                eq(dossierAssignments.status, AssignmentStatus.COMPLETED),
            ),
            columns: {
                id: true,
                allowedFields: true,
            },
        });

        const resetMakerAssignmentIds: string[] = [];

        for (const maker of completedMakers) {
            const allowedFields = parseAllowedFields(maker.allowedFields);
            const shouldReset = shouldResetMakerOnReject(
                allowedFields,
                selectiveReject ? input.rejectFields! : null,
            );

            if (shouldReset) {
                const makerRejectFields = selectiveReject
                    ? filterRejectFieldsForAssignment(input.rejectFields!, allowedFields)
                    : null;

                await tx
                    .update(dossierAssignments)
                    .set({
                        status: AssignmentStatus.IN_PROGRESS,
                        attemptNumber: sql`${dossierAssignments.attemptNumber} + 1`,
                        completedAt: null,
                        assignedAt: now,
                        metadataKey: null,
                        rejectFields: serializeRejectFields(makerRejectFields),
                    })
                    .where(eq(dossierAssignments.id, maker.id));
                resetMakerAssignmentIds.push(maker.id);
                reopenedMakerCount++;
            } else {
                await tx
                    .update(dossierAssignments)
                    .set({ rejectFields: null })
                    .where(eq(dossierAssignments.id, maker.id));
            }
        }

        // Đóng issue CONFIRMED của các maker bị reset, tránh trạng thái mồ côi.
        if (resetMakerAssignmentIds.length > 0) {
            const { IssueReportService } = await import(
                "../issue-report/issue-report-service.ts"
            );
            await IssueReportService.closeConfirmedForResetMakers(tx, resetMakerAssignmentIds);
        }

        if (selectiveReject && reopenedMakerCount === 0) {
            throw httpError.badRequest(
                "reject_fields do not match any editor assignment for this dossier",
            );
        }

        if (checkerRolesToReset.length > 0) {
            await tx
                .update(dossierAssignments)
                .set({
                    status: AssignmentStatus.IN_PROGRESS,
                    attemptNumber: sql`${dossierAssignments.attemptNumber} + 1`,
                    completedAt: null,
                    assignedAt: now,
                })
                .where(and(
                    eq(dossierAssignments.dossierId, input.dossierId),
                    inArray(
                        dossierAssignments.role,
                        checkerRolesToReset as [WorkerRoleType, ...WorkerRoleType[]],
                    ),
                    eq(dossierAssignments.status, AssignmentStatus.COMPLETED),
                ));
        }

        const [dossierRow] = await tx
            .update(dossiers)
            .set({
                status: DossierStatus.READY_FOR_ENTRY,
                rejectCount: dossier.rejectCount + 1,
                lastRejectNotes: input.notes,
                updatedAt: now,
            })
            .where(activeDossierWhere(eq(dossiers.id, dossier.id)))
            .returning();

        if (!dossierRow) {
            throw httpError.notFound("Dossier not found");
        }

        const workflowNotes = selectiveReject
            ? `${input.notes}\n[reject_fields: ${JSON.stringify(input.rejectFields)}]`
            : input.notes;

        await insertWorkflowLog(tx, {
            dossierId: dossier.id,
            actorId: input.actorId,
            action: workflowAction,
            fromStatus: dossier.status,
            toStatus: DossierStatus.READY_FOR_ENTRY,
            notes: workflowNotes,
        });

        return dossierRow;
    });

    const reopenedRoles: WorkerRoleType[] = [...checkerRolesToReset];
    if (reopenedMakerCount > 0) {
        reopenedRoles.unshift(WorkerRole.MAKER);
    }

    return {
        dossierId: dossier.id,
        assignmentId: assignment.id,
        dossierStatus: updatedDossier.status,
        rejectCount: updatedDossier.rejectCount,
        rejectedQcStep: checkerConfig.step,
        reopenedRoles,
        reopenedMakerCount,
        rejectFields: selectiveReject ? input.rejectFields! : null,
    };
}

export const DataEntryService = {
    async getMakerAssignment(assigneeId: string) {
        const claimableStatuses = [
            DossierStatus.ENTRY_PROCESSING,
            DossierStatus.WAITING_ISSUE_RESOLUTION,
            ...CHECKER_REJECTED_STATUSES,
            DossierStatus.READY_FOR_ENTRY,
        ] as const;

        const findAssignment = async (
            status: AssignmentStatusType,
        ) => await db.transaction(async (tx) => {
            const [row] = await tx
                .select({
                    assignment: dossierAssignments,
                    dossier: dossiers,
                })
                .from(dossierAssignments)
                .innerJoin(dossiers, eq(dossierAssignments.dossierId, dossiers.id))
                .where(and(
                    eq(dossierAssignments.assigneeId, assigneeId),
                    eq(dossierAssignments.role, WorkerRole.MAKER),
                    eq(dossierAssignments.status, status),
                    activeDossierWhere(inArray(dossiers.status, [...claimableStatuses])),
                ))
                .orderBy(
                    desc(dossierAssignments.attemptNumber),
                    makerGetPriority,
                    asc(dossiers.updatedAt),
                )
                .limit(1)
                .for("update", { skipLocked: true });

            if (!row) {
                return null;
            }

            if (
                row.dossier.status === DossierStatus.ENTRY_PROCESSING ||
                row.dossier.status === DossierStatus.WAITING_ISSUE_RESOLUTION
            ) {
                return row;
            }

            const fromStatus = row.dossier.status;

            const [updatedDossier] = await tx
                .update(dossiers)
                .set({
                    status: DossierStatus.ENTRY_PROCESSING,
                    updatedAt: new Date(),
                })
                .where(activeDossierWhere(
                    eq(dossiers.id, row.dossier.id),
                    inArray(dossiers.status, [
                        ...CHECKER_REJECTED_STATUSES,
                        DossierStatus.READY_FOR_ENTRY,
                    ]),
                ))
                .returning();

            if (!updatedDossier) {
                return row;
            }

            await insertWorkflowLog(tx, {
                dossierId: updatedDossier.id,
                actorId: assigneeId,
                action: WORKFLOW_ACTION.CLAIM_ENTRY,
                fromStatus,
                toStatus: DossierStatus.ENTRY_PROCESSING,
            });

            return { assignment: row.assignment, dossier: updatedDossier };
        });

        let result = (await findAssignment(AssignmentStatus.IN_PROGRESS))
            ?? (await findAssignment(AssignmentStatus.DRAFT));

        if (!result) {
            const { reopenTopCompletedMakerAssignmentForClaim } = await import(
                "./maker-assignment-resolve.ts"
            );
            const reopened = await reopenTopCompletedMakerAssignmentForClaim(assigneeId);
            if (reopened) {
                result = await findAssignment(AssignmentStatus.IN_PROGRESS);
            }
        }

        if (!result) {
            throw httpError.notFound("No assigned dossier found");
        }

        return await buildClaimPayload(result.assignment, result.dossier);
    },

    async getMakerAssignmentForDossier(assigneeId: string, dossierId: string) {
        const { resolveWorkableMakerAssignmentForActor } = await import(
            "./maker-assignment-resolve.ts"
        );
        const assignment = await resolveWorkableMakerAssignmentForActor(
            dossierId,
            assigneeId,
        );
        if (!assignment) {
            throw httpError.notFound(
                "No workable MAKER assignment found for this dossier",
            );
        }
        return await buildClaimPayload(assignment, assignment.dossier);
    },

    async claimChecker(assigneeId: string, role: WorkerRoleType) {
        const config = getCheckerConfig(role);
        return await claimDossier({
            role: config.role,
            assigneeId,
            allowedStatuses: [config.waiting],
            processingStatus: config.processing,
            workflowAction: checkerWorkflowAction("CLAIM", config.step),
        });
    },

    async approveCheckerByDossier(dossierId: string, actorId: string, metadata: unknown) {
        const dossier = await db.query.dossiers.findFirst({
            where: activeDossierWhere(eq(dossiers.id, dossierId)),
            columns: { currentQcStep: true },
        });

        if (!dossier) {
            throw httpError.notFound("Dossier not found");
        }

        const config = getCheckerConfigForCurrentQcStep(dossier.currentQcStep);
        const { IssueReportService } = await import("../issue-report/issue-report-service.ts");
        await IssueReportService.assertCheckerNotBlocked(dossierId, config.step);

        return await approveMetadata({
            dossierId,
            actorId,
            role: config.role,
            metadata,
            workflowAction: checkerWorkflowAction("APPROVE", config.step),
        });
    },

    async approveCheckerByRole(
        dossierId: string,
        actorId: string,
        role: WorkerRoleType,
        metadata: unknown,
    ) {
        const config = getCheckerConfig(role);
        const { IssueReportService } = await import("../issue-report/issue-report-service.ts");
        await IssueReportService.assertCheckerNotBlocked(dossierId, config.step);

        return await approveMetadata({
            dossierId,
            actorId,
            role,
            metadata,
            workflowAction: checkerWorkflowAction("APPROVE", config.step),
        });
    },

    async rejectCheckerByDossier(
        dossierId: string,
        actorId: string,
        notes: string,
        rejectFields?: string[] | null,
        options?: {
            bypassIssueReportBlock?: boolean;
            assignmentResolver?: "actor" | "role";
        },
    ) {
        const dossier = await db.query.dossiers.findFirst({
            where: activeDossierWhere(eq(dossiers.id, dossierId)),
            columns: { currentQcStep: true },
        });

        if (!dossier) {
            throw httpError.notFound("Dossier not found");
        }

        const config = getCheckerConfigForCurrentQcStep(dossier.currentQcStep);

        if (!options?.bypassIssueReportBlock) {
            const { IssueReportService } = await import("../issue-report/issue-report-service.ts");
            await IssueReportService.assertCheckerNotBlocked(dossierId, config.step);
        }

        return await rejectMetadata({
            dossierId,
            actorId,
            role: config.role,
            notes,
            rejectFields,
            workflowAction: checkerWorkflowAction("REJECT", config.step),
            assignmentResolver: options?.assignmentResolver,
        });
    },

    directApproveDossier,
};
