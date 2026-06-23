import { httpError } from "@shared/common-lib";
import { and, eq, inArray } from "drizzle-orm";
import { isActiveDossier } from "../dossier/active-query-filters.ts";
import { db } from "../../db/db-conn.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import {
    AssignmentStatus,
    QC_CHECKER_WORKFLOW,
    WorkerRole,
    type WorkerRole as WorkerRoleType,
} from "../../db/schemas/workflow-constants.ts";

const METADATA_EDITOR_ROLES = [
    WorkerRole.MAKER,
    ...QC_CHECKER_WORKFLOW.map((config) => config.role),
] as const;

async function loadDraftAssignmentForActor(dossierId: string, actorId: string) {
    const assignment = await db.query.dossierAssignments.findFirst({
        where: and(
            eq(dossierAssignments.dossierId, dossierId),
            eq(dossierAssignments.assigneeId, actorId),
            eq(dossierAssignments.status, AssignmentStatus.DRAFT),
            inArray(dossierAssignments.role, [...METADATA_EDITOR_ROLES]),
        ),
        with: { dossier: true },
    });

    if (!isActiveDossier(assignment?.dossier)) {
        throw httpError.notFound("No DRAFT assignment found for this dossier");
    }

    return assignment;
}

function resolveErrorMessage(error: unknown): string {
    if (error && typeof error === "object" && "message" in error) {
        return String((error as { message: unknown }).message);
    }
    return String(error);
}

async function submitSingleDraftAssignment(input: {
    actorId: string;
    dossierId: string;
    metadata: unknown;
}) {
    const assignment = await loadDraftAssignmentForActor(input.dossierId, input.actorId);

    if (assignment.role === WorkerRole.MAKER) {
        const { DossierService } = await import("../dossier/dossier-service.ts");
        const result = await DossierService.saveDossierMetadata(
            input.dossierId,
            input.metadata,
            input.actorId,
        );
        return {
            dossierId: input.dossierId,
            assignmentId: assignment.id,
            role: assignment.role as WorkerRoleType,
            dossierStatus: result.dossierStatus,
            metadataKey: result.currentMetadataKey,
            currentMetadataUrl: result.currentMetadataUrl,
            partial: result.partial,
        };
    }

    const { DataEntryService } = await import("./data-entry-service.ts");
    const result = await DataEntryService.approveCheckerByRole(
        input.dossierId,
        input.actorId,
        assignment.role as WorkerRoleType,
        input.metadata,
    );
    return {
        dossierId: input.dossierId,
        assignmentId: result.assignmentId,
        role: assignment.role as WorkerRoleType,
        dossierStatus: result.dossierStatus,
        metadataKey: result.metadataKey,
        currentQcStep: result.currentQcStep,
        approvedQcStep: result.approvedQcStep,
    };
}

/** Gửi đi / duyệt đồng loạt các phân công đang DRAFT (MAKER hoặc CHECKER). */
export async function bulkSubmitDraftMetadata(
    actorId: string,
    items: Array<{ dossierId: string; metadata: unknown }>,
) {
    const seenDossierIds = new Set<string>();
    const submitted: Awaited<ReturnType<typeof submitSingleDraftAssignment>>[] = [];
    const failed: Array<{ dossierId: string; error: string }> = [];

    for (const item of items) {
        if (seenDossierIds.has(item.dossierId)) {
            failed.push({
                dossierId: item.dossierId,
                error: "Duplicate dossierId in request",
            });
            continue;
        }
        seenDossierIds.add(item.dossierId);

        try {
            const result = await submitSingleDraftAssignment({
                actorId,
                dossierId: item.dossierId,
                metadata: item.metadata,
            });
            submitted.push(result);
        } catch (error) {
            failed.push({
                dossierId: item.dossierId,
                error: resolveErrorMessage(error),
            });
        }
    }

    return {
        submitted,
        failed,
        submittedCount: submitted.length,
        failedCount: failed.length,
    };
}
