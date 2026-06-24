import { httpError } from "@shared/common-lib";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import { db } from "../../db/db-conn.ts";
import { dossierIssueReports } from "../../db/schemas/issue-report.ts";
import {
    BLOCKING_ISSUE_REPORT_STATUSES,
    IssueReportStatus,
} from "../../db/schemas/issue-report-constants.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { groups } from "../../db/schemas/groups.ts";
import { projects } from "../../db/schemas/project.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
import { WorkerRole } from "../../db/schemas/workflow-constants.ts";
import type { IssueReportInput, IssueReportResponse } from "./types.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function toResponse(row: typeof dossierIssueReports.$inferSelect): IssueReportResponse {
    return {
        id: row.id,
        dossierId: row.dossierId,
        reporterId: row.reporterId,
        status: row.status,
        type: row.type,
        notes: row.notes,
        escalatedToId: row.escalatedToId,
        createdAt: row.createdAt.toISOString(),
        resolvedAt: row.resolvedAt?.toISOString() ?? null,
        blocksChecker: BLOCKING_ISSUE_REPORT_STATUSES.includes(
            row.status as (typeof BLOCKING_ISSUE_REPORT_STATUSES)[number],
        ),
    };
}

async function insertIssueWorkflowLog(
    tx: DbTx,
    input: {
        dossierId: string;
        actorId: string;
        action: string;
        notes?: string | null;
    },
) {
    await tx.insert(workflowLogs).values({
        dossierId: input.dossierId,
        actorId: input.actorId,
        action: input.action,
        fromStatus: null,
        toStatus: null,
        notes: input.notes ?? null,
    });
}

async function resolveProjectManagerId(dossierId: string): Promise<string> {
    const dossier = await db.query.dossiers.findFirst({
        where: activeDossierWhere(eq(dossiers.id, dossierId)),
        columns: { projectCode: true, assignedGroupId: true },
    });

    if (!dossier) {
        throw httpError.notFound("Dossier not found");
    }

    let projectCode = dossier.projectCode;
    if (!projectCode && dossier.assignedGroupId) {
        const group = await db.query.groups.findFirst({
            where: and(
                eq(groups.id, dossier.assignedGroupId),
                isNull(groups.deletedAt),
            ),
            columns: { projectCode: true },
        });
        projectCode = group?.projectCode ?? null;
    }

    if (!projectCode) {
        throw httpError.badRequest("Hồ sơ chưa gắn dự án — không thể chuyển tiếp quản lý dự án");
    }

    const project = await db.query.projects.findFirst({
        where: and(
            eq(projects.projectCode, projectCode),
            isNull(projects.deletedAt),
        ),
        columns: { managerId: true },
    });

    if (!project?.managerId) {
        throw httpError.badRequest("Dự án chưa có quản lý dự án được gán");
    }

    return project.managerId;
}

async function getOpenIssueReportForDossier(
    dossierId: string,
    tx: DbTx | typeof db = db,
) {
    return await tx.query.dossierIssueReports.findFirst({
        where: and(
            eq(dossierIssueReports.dossierId, dossierId),
            inArray(dossierIssueReports.status, [
                IssueReportStatus.PENDING,
                IssueReportStatus.CONFIRMED,
                IssueReportStatus.ESCALATED,
            ]),
        ),
        orderBy: desc(dossierIssueReports.createdAt),
    });
}

export const IssueReportService = {
    async createOnMakerSubmit(
        tx: DbTx,
        input: {
            dossierId: string;
            reporterId: string;
            reporterAssignmentId: string;
            issueReport: IssueReportInput;
        },
    ) {
        const existing = await getOpenIssueReportForDossier(input.dossierId, tx);
        if (existing) {
            throw httpError.conflict("Hồ sơ đã có thông báo vấn đề đang mở");
        }

        const [row] = await tx.insert(dossierIssueReports).values({
            dossierId: input.dossierId,
            reporterId: input.reporterId,
            reporterAssignmentId: input.reporterAssignmentId,
            targetRole: WorkerRole.CHECKER_1,
            status: IssueReportStatus.PENDING,
            type: input.issueReport.type,
            notes: input.issueReport.notes,
        }).returning();

        await insertIssueWorkflowLog(tx, {
            dossierId: input.dossierId,
            actorId: input.reporterId,
            action: "ISSUE_REPORT_SUBMITTED",
            notes: input.issueReport.notes,
        });

        return toResponse(row);
    },

    async getForDossier(dossierId: string): Promise<IssueReportResponse | null> {
        const row = await getOpenIssueReportForDossier(dossierId);
        return row ? toResponse(row) : null;
    },

    async assertCheckerNotBlocked(dossierId: string, checkerStep: number) {
        if (checkerStep !== 1) {
            return;
        }

        const row = await getOpenIssueReportForDossier(dossierId);
        if (!row) {
            return;
        }

        if (BLOCKING_ISSUE_REPORT_STATUSES.includes(
            row.status as (typeof BLOCKING_ISSUE_REPORT_STATUSES)[number],
        )) {
            throw httpError.conflict(
                "Hồ sơ có thông báo vấn đề đang chờ xử lý. Vui lòng xác nhận, từ chối hoặc chuyển tiếp trước.",
            );
        }
    },

    async getByIdOrThrow(reportId: string) {
        const row = await db.query.dossierIssueReports.findFirst({
            where: eq(dossierIssueReports.id, reportId),
        });

        if (!row) {
            throw httpError.notFound("Không tìm thấy thông báo vấn đề");
        }

        return row;
    },

    async confirm(reportId: string, actorId: string) {
        const row = await IssueReportService.getByIdOrThrow(reportId);

        if (row.status !== IssueReportStatus.PENDING) {
            throw httpError.conflict("Chỉ có thể xác nhận thông báo đang chờ xử lý");
        }

        const now = new Date();
        const [updated] = await db.update(dossierIssueReports)
            .set({
                status: IssueReportStatus.CONFIRMED,
                resolvedById: actorId,
                resolvedAt: now,
                updatedAt: now,
            })
            .where(and(
                eq(dossierIssueReports.id, reportId),
                eq(dossierIssueReports.status, IssueReportStatus.PENDING),
            ))
            .returning();

        if (!updated) {
            throw httpError.conflict("Thông báo đã được xử lý");
        }

        await db.insert(workflowLogs).values({
            dossierId: row.dossierId,
            actorId,
            action: "ISSUE_REPORT_CONFIRMED",
            fromStatus: null,
            toStatus: null,
            notes: row.notes,
        });

        return toResponse(updated);
    },

    async reject(
        reportId: string,
        actorId: string,
        notes: string,
        rejectFields?: string[] | null,
    ) {
        const row = await IssueReportService.getByIdOrThrow(reportId);

        if (row.status !== IssueReportStatus.PENDING) {
            throw httpError.conflict("Chỉ có thể từ chối thông báo đang chờ xử lý");
        }

        const { DataEntryService } = await import("../data-entry/data-entry-service.ts");
        const rejectResult = await DataEntryService.rejectCheckerByDossier(
            row.dossierId,
            actorId,
            notes,
            rejectFields,
            { bypassIssueReportBlock: true },
        );

        const now = new Date();
        await db.update(dossierIssueReports)
            .set({
                status: IssueReportStatus.REJECTED,
                resolvedById: actorId,
                resolvedAt: now,
                updatedAt: now,
            })
            .where(eq(dossierIssueReports.id, reportId));

        await db.insert(workflowLogs).values({
            dossierId: row.dossierId,
            actorId,
            action: "ISSUE_REPORT_REJECTED",
            fromStatus: null,
            toStatus: null,
            notes,
        });

        return {
            issueReport: toResponse({
                ...row,
                status: IssueReportStatus.REJECTED,
                resolvedById: actorId,
                resolvedAt: now,
                updatedAt: now,
            }),
            reject: rejectResult,
        };
    },

    async escalate(reportId: string, actorId: string) {
        const row = await IssueReportService.getByIdOrThrow(reportId);

        if (row.status !== IssueReportStatus.PENDING) {
            throw httpError.conflict("Chỉ có thể chuyển tiếp thông báo đang chờ xử lý");
        }

        const managerId = await resolveProjectManagerId(row.dossierId);
        const now = new Date();

        const [updated] = await db.update(dossierIssueReports)
            .set({
                status: IssueReportStatus.ESCALATED,
                escalatedToId: managerId,
                updatedAt: now,
            })
            .where(and(
                eq(dossierIssueReports.id, reportId),
                eq(dossierIssueReports.status, IssueReportStatus.PENDING),
            ))
            .returning();

        if (!updated) {
            throw httpError.conflict("Thông báo đã được xử lý");
        }

        await db.insert(workflowLogs).values({
            dossierId: row.dossierId,
            actorId,
            action: "ISSUE_REPORT_ESCALATED",
            fromStatus: null,
            toStatus: null,
            notes: row.notes,
        });

        return toResponse(updated);
    },

    async confirmByProjectManager(reportId: string, actorId: string) {
        const row = await IssueReportService.getByIdOrThrow(reportId);

        if (row.status !== IssueReportStatus.ESCALATED) {
            throw httpError.conflict("Chỉ có thể xác nhận thông báo đã chuyển tiếp");
        }

        if (row.escalatedToId !== actorId) {
            throw httpError.forbidden("Bạn không phải quản lý dự án được chuyển tiếp");
        }

        const now = new Date();
        const [updated] = await db.update(dossierIssueReports)
            .set({
                status: IssueReportStatus.CONFIRMED,
                resolvedById: actorId,
                resolvedAt: now,
                updatedAt: now,
            })
            .where(and(
                eq(dossierIssueReports.id, reportId),
                eq(dossierIssueReports.status, IssueReportStatus.ESCALATED),
            ))
            .returning();

        if (!updated) {
            throw httpError.conflict("Thông báo đã được xử lý");
        }

        await db.insert(workflowLogs).values({
            dossierId: row.dossierId,
            actorId,
            action: "ISSUE_REPORT_PM_CONFIRMED",
            fromStatus: null,
            toStatus: null,
            notes: row.notes,
        });

        return toResponse(updated);
    },

    async rejectByProjectManager(
        reportId: string,
        actorId: string,
        notes: string,
        rejectFields?: string[] | null,
    ) {
        const row = await IssueReportService.getByIdOrThrow(reportId);

        if (row.status !== IssueReportStatus.ESCALATED) {
            throw httpError.conflict("Chỉ có thể từ chối thông báo đã chuyển tiếp");
        }

        if (row.escalatedToId !== actorId) {
            throw httpError.forbidden("Bạn không phải quản lý dự án được chuyển tiếp");
        }

        const { DataEntryService } = await import("../data-entry/data-entry-service.ts");
        const rejectResult = await DataEntryService.rejectCheckerByDossier(
            row.dossierId,
            actorId,
            notes,
            rejectFields,
            { bypassIssueReportBlock: true, assignmentResolver: "role" },
        );

        const now = new Date();
        await db.update(dossierIssueReports)
            .set({
                status: IssueReportStatus.REJECTED,
                resolvedById: actorId,
                resolvedAt: now,
                updatedAt: now,
            })
            .where(eq(dossierIssueReports.id, reportId));

        await db.insert(workflowLogs).values({
            dossierId: row.dossierId,
            actorId,
            action: "ISSUE_REPORT_PM_REJECTED",
            fromStatus: null,
            toStatus: null,
            notes,
        });

        return {
            issueReport: toResponse({
                ...row,
                status: IssueReportStatus.REJECTED,
                resolvedById: actorId,
                resolvedAt: now,
                updatedAt: now,
            }),
            reject: rejectResult,
        };
    },

    async listForProjectManager(input: {
        managerId: string;
        status?: IssueReportStatus;
        projectCodes?: string[];
        limit?: number;
        offset?: number;
    }) {
        const conditions = [eq(dossierIssueReports.escalatedToId, input.managerId)];

        if (input.status) {
            conditions.push(eq(dossierIssueReports.status, input.status));
        } else {
            conditions.push(inArray(dossierIssueReports.status, [
                IssueReportStatus.ESCALATED,
                IssueReportStatus.CONFIRMED,
                IssueReportStatus.REJECTED,
                IssueReportStatus.CLOSED,
            ]));
        }

        const rows = await db.query.dossierIssueReports.findMany({
            where: and(...conditions),
            orderBy: desc(dossierIssueReports.createdAt),
            limit: input.limit ?? 50,
            offset: input.offset ?? 0,
            with: {
                dossier: {
                    columns: { id: true, name: true, projectCode: true, status: true },
                },
                reporter: {
                    columns: { id: true, fullName: true },
                },
            },
        });

        const filtered = input.projectCodes?.length
            ? rows.filter((row) =>
                row.dossier?.projectCode
                && input.projectCodes!.includes(row.dossier.projectCode)
            )
            : rows;

        return filtered.map((row) => ({
            ...toResponse(row),
            dossierName: row.dossier?.name ?? null,
            dossierStatus: row.dossier?.status ?? null,
            projectCode: row.dossier?.projectCode ?? null,
            reporterName: row.reporter?.fullName ?? null,
        }));
    },

    async closeConfirmedOnCheckerApprove(tx: DbTx, dossierId: string) {
        const row = await getOpenIssueReportForDossier(dossierId, tx);
        if (!row || row.status !== IssueReportStatus.CONFIRMED) {
            return;
        }

        const now = new Date();
        await tx.update(dossierIssueReports)
            .set({
                status: IssueReportStatus.CLOSED,
                updatedAt: now,
            })
            .where(eq(dossierIssueReports.id, row.id));
    },

    async hasConfirmedMakerIssueWaiver(
        tx: DbTx,
        dossierId: string,
    ): Promise<boolean> {
        const row = await tx.query.dossierIssueReports.findFirst({
            where: and(
                eq(dossierIssueReports.dossierId, dossierId),
                eq(dossierIssueReports.status, IssueReportStatus.CONFIRMED),
                eq(dossierIssueReports.targetRole, WorkerRole.CHECKER_1),
            ),
            columns: { id: true },
        });
        return !!row;
    },
};

export { getOpenIssueReportForDossier, toResponse as toIssueReportResponse };
