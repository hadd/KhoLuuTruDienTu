import { and, eq, inArray, ne } from "drizzle-orm";
import type { db } from "../db/db-conn.ts";
import { dossierAssignments } from "../db/schemas/dossier-assignment.ts";
import { dossierIssueReports } from "../db/schemas/issue-report.ts";
import { IssueReportStatus } from "../db/schemas/issue-report-constants.ts";
import { dossiers } from "../db/schemas/dossier.ts";
import { workflowLogs } from "../db/schemas/workflow-log.ts";
import {
    AssignmentStatus,
    DossierStatus,
    type DossierStatus as DossierStatusType,
} from "../db/schemas/workflow-constants.ts";
import { activeDossierWhere } from "../modules/dossier/active-query-filters.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const SIBLING_ISSUE_STATUSES_TO_CLOSE = [
    IssueReportStatus.PENDING,
    IssueReportStatus.CONFIRMED,
] as const;

/**
 * QC escalate → PM: tạm dừng phân công editor/QC, chuyển hồ sơ sang
 * WAITING_ISSUE_RESOLUTION để PM xem metadata hiện tại và xử lý.
 * Metadata, lịch sử chỉnh sửa và file S3 được giữ nguyên.
 */
export async function invalidateDossierWorkflowOnEscalate(
    tx: DbTx,
    input: {
        dossierId: string;
        actorId: string;
        fromStatus: DossierStatusType;
        now: Date;
        /** Báo cáo vừa escalate — giữ ESCALATED, đóng các issue còn lại. */
        keepEscalatedReportId: string;
    },
): Promise<{
    transferredAssignmentCount: number;
    closedSiblingIssueCount: number;
}> {
    const assignments = await tx.query.dossierAssignments.findMany({
        where: and(
            eq(dossierAssignments.dossierId, input.dossierId),
            ne(dossierAssignments.status, AssignmentStatus.TRANSFERRED),
        ),
        columns: { id: true },
    });

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
            resolveNotes: "Đóng tự động — hồ sơ chuyển lên PM xử lý",
            updatedAt: input.now,
        })
        .where(and(
            eq(dossierIssueReports.dossierId, input.dossierId),
            inArray(dossierIssueReports.status, [...SIBLING_ISSUE_STATUSES_TO_CLOSE]),
            ne(dossierIssueReports.id, input.keepEscalatedReportId),
        ))
        .returning({ id: dossierIssueReports.id });

    await tx
        .update(dossiers)
        .set({
            status: DossierStatus.WAITING_ISSUE_RESOLUTION,
            assignedGroupId: null,
            currentQcStep: 0,
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
            "Issue escalated to PM — paused editor/QC assignments; metadata preserved for review",
    });

    return {
        transferredAssignmentCount: assignments.length,
        closedSiblingIssueCount: closedSiblings.length,
    };
}
