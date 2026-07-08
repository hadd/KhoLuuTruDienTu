import { and, eq, inArray, ne } from "drizzle-orm";
import type { db } from "../db/db-conn.ts";
import { dossierAssignments } from "../db/schemas/dossier-assignment.ts";
import { dossierIssueReports } from "../db/schemas/issue-report.ts";
import { IssueReportStatus } from "../db/schemas/issue-report-constants.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { metadataHistory } from "../db/schemas/metadata-history.ts";
import { workflowLogs } from "../db/schemas/workflow-log.ts";
import {
    AssignmentStatus,
    DossierStatus,
    type DossierStatus as DossierStatusType,
} from "../db/schemas/workflow-constants.ts";
import { activeDossierWhere } from "../modules/dossier/active-query-filters.ts";
import { deleteDossierDraftMetadata } from "../modules/data-entry/metadata-draft-service.ts";
import { deleteJsonFromStorage } from "../modules/data-entry/data-entry-s3-utils.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const SIBLING_ISSUE_STATUSES_TO_CLOSE = [
    IssueReportStatus.PENDING,
    IssueReportStatus.CONFIRMED,
] as const;

/**
 * QC escalate → PM: hủy toàn bộ phân công editor/QC, xóa draft/history,
 * reset hồ sơ về WAITING_ISSUE_RESOLUTION để PM upload/OCR lại rồi phân công mới.
 * PM không có dòng dossier_assignments — không bị ảnh hưởng.
 */
export async function invalidateDossierWorkflowOnEscalate(
    tx: DbTx,
    input: {
        dossierId: string;
        actorId: string;
        fromStatus: DossierStatusType;
        now: Date;
        currentMetadataKey: string | null;
        ocrMetadataKey: string | null;
        /** Báo cáo vừa escalate — giữ ESCALATED, đóng các issue còn lại. */
        keepEscalatedReportId: string;
    },
): Promise<{
    transferredAssignmentCount: number;
    deletedHistoryCount: number;
    closedSiblingIssueCount: number;
}> {
    const assignments = await tx.query.dossierAssignments.findMany({
        where: and(
            eq(dossierAssignments.dossierId, input.dossierId),
            ne(dossierAssignments.status, AssignmentStatus.TRANSFERRED),
        ),
        columns: { id: true, metadataKey: true },
    });

    const historyRows = await tx
        .select({ id: metadataHistory.id, s3Key: metadataHistory.s3Key })
        .from(metadataHistory)
        .where(eq(metadataHistory.dossierId, input.dossierId));

    if (assignments.length > 0) {
        await tx
            .update(dossierAssignments)
            .set({
                status: AssignmentStatus.TRANSFERRED,
                completedAt: input.now,
            })
            .where(and(
                eq(dossierAssignments.dossierId, input.dossierId),
                inArray(
                    dossierAssignments.id,
                    assignments.map((row) => row.id) as [string, ...string[]],
                ),
            ));
    }

    const closedSiblings = await tx
        .update(dossierIssueReports)
        .set({
            status: IssueReportStatus.CLOSED,
            resolvedById: input.actorId,
            resolvedAt: input.now,
            resolveNotes: "Đóng tự động — hồ sơ bị hủy luồng khi escalate lên PM",
            updatedAt: input.now,
        })
        .where(and(
            eq(dossierIssueReports.dossierId, input.dossierId),
            inArray(dossierIssueReports.status, [...SIBLING_ISSUE_STATUSES_TO_CLOSE]),
            ne(dossierIssueReports.id, input.keepEscalatedReportId),
        ))
        .returning({ id: dossierIssueReports.id });

    if (historyRows.length > 0) {
        await tx
            .delete(metadataHistory)
            .where(eq(metadataHistory.dossierId, input.dossierId));
    }

    await tx
        .update(dossiers)
        .set({
            status: DossierStatus.WAITING_ISSUE_RESOLUTION,
            assignedGroupId: null,
            currentQcStep: 0,
            currentMetadataKey: input.ocrMetadataKey,
            updatedAt: input.now,
        })
        .where(activeDossierWhere(eq(dossiers.id, input.dossierId)));

    await tx.insert(workflowLogs).values({
        dossierId: input.dossierId,
        actorId: input.actorId,
        action: "INVALIDATE_WORKFLOW_ON_ESCALATE",
        fromStatus: input.fromStatus,
        toStatus: DossierStatus.WAITING_ISSUE_RESOLUTION,
        notes:
            "Issue escalated to PM — cleared editor/QC assignments for re-upload and reassignment",
    });

    await deleteDossierDraftMetadata({
        currentMetadataKey: input.currentMetadataKey,
        ocrMetadataKey: input.ocrMetadataKey,
    });
    for (const row of assignments) {
        await deleteDossierDraftMetadata({
            currentMetadataKey: input.currentMetadataKey,
            ocrMetadataKey: input.ocrMetadataKey,
            assignmentId: row.id,
        });
    }

    const storageKeys = new Set<string>();
    for (const row of assignments) {
        if (row.metadataKey) {
            storageKeys.add(row.metadataKey);
        }
    }
    for (const row of historyRows) {
        if (row.s3Key) {
            storageKeys.add(row.s3Key);
        }
    }

    for (const key of storageKeys) {
        try {
            await deleteJsonFromStorage(key);
        } catch (err) {
            console.error("[WorkflowInvalidate] Failed to delete storage key:", key, err);
        }
    }

    return {
        transferredAssignmentCount: assignments.length,
        deletedHistoryCount: historyRows.length,
        closedSiblingIssueCount: closedSiblings.length,
    };
}
