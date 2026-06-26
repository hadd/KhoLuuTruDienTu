import { httpError } from "@shared/common-lib";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import { db } from "../../db/db-conn.ts";
import { dossierIssueReports } from "../../db/schemas/issue-report.ts";
import { dossierAssignments } from "../../db/schemas/dossier-assignment.ts";
import {
    BLOCKING_ISSUE_REPORT_STATUSES,
    IssueReportStatus,
} from "../../db/schemas/issue-report-constants.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { groups } from "../../db/schemas/groups.ts";
import { projects } from "../../db/schemas/project.ts";
import { workflowLogs } from "../../db/schemas/workflow-log.ts";
import {
    AssignmentStatus,
    DossierStatus,
    QC_CHECKER_BY_STEP,
    WORKABLE_ASSIGNMENT_STATUSES,
    WorkerRole,
    type DossierStatus as DossierStatusType,
} from "../../db/schemas/workflow-constants.ts";
import {
    filterRejectFieldsForAssignment,
    parseAllowedFields,
    serializeRejectFields,
} from "../../libs/metadata-field-filter.ts";
import type { IssueReportInput, IssueReportResponse } from "./types.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const OPEN_ISSUE_REPORT_STATUSES = [
    IssueReportStatus.PENDING,
    IssueReportStatus.CONFIRMED,
    IssueReportStatus.ESCALATED,
] as const;

function toResponse(
    row: typeof dossierIssueReports.$inferSelect,
    reporterName: string | null = null,
): IssueReportResponse {
    return {
        id: row.id,
        dossierId: row.dossierId,
        reporterId: row.reporterId,
        reporterName,
        reporterAssignmentId: row.reporterAssignmentId,
        status: row.status,
        type: row.type,
        notes: row.notes,
        resolveNotes: row.resolveNotes ?? null,
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

async function resolveProjectManagerId(
    dossierId: string,
    queryExecutor: DbTx | typeof db = db,
): Promise<string> {
    const dossier = await queryExecutor.query.dossiers.findFirst({
        where: activeDossierWhere(eq(dossiers.id, dossierId)),
        columns: { projectCode: true, assignedGroupId: true },
    });

    if (!dossier) {
        throw httpError.notFound("Dossier not found");
    }

    let projectCode = dossier.projectCode;
    if (!projectCode && dossier.assignedGroupId) {
        const group = await queryExecutor.query.groups.findFirst({
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

    const project = await queryExecutor.query.projects.findFirst({
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

async function resolveCheckerResumeStatus(
    tx: DbTx,
    dossierId: string,
    currentQcStep: number,
): Promise<DossierStatusType> {
    const checkerConfig = QC_CHECKER_BY_STEP.get(currentQcStep + 1);
    if (!checkerConfig) {
        throw httpError.internal(
            `No checker workflow configured for QC step ${currentQcStep + 1}`,
        );
    }

    const activeAssignment = await tx.query.dossierAssignments.findFirst({
        where: and(
            eq(dossierAssignments.dossierId, dossierId),
            eq(dossierAssignments.role, checkerConfig.role),
            inArray(dossierAssignments.status, [...WORKABLE_ASSIGNMENT_STATUSES]),
        ),
        columns: { id: true },
    });

    return activeAssignment ? checkerConfig.processing : checkerConfig.waiting;
}

async function getOpenIssueReportForAssignment(
    reporterAssignmentId: string,
    tx: DbTx | typeof db = db,
) {
    return await tx.query.dossierIssueReports.findFirst({
        where: and(
            eq(dossierIssueReports.reporterAssignmentId, reporterAssignmentId),
            inArray(dossierIssueReports.status, [...OPEN_ISSUE_REPORT_STATUSES]),
        ),
        orderBy: desc(dossierIssueReports.createdAt),
    });
}

async function getOpenIssueReportsForDossier(
    dossierId: string,
    tx: DbTx | typeof db = db,
) {
    return await tx.query.dossierIssueReports.findMany({
        where: and(
            eq(dossierIssueReports.dossierId, dossierId),
            inArray(dossierIssueReports.status, [...OPEN_ISSUE_REPORT_STATUSES]),
        ),
        orderBy: desc(dossierIssueReports.createdAt),
    });
}

async function hasBlockingIssueReportsForDossier(
    dossierId: string,
    tx: DbTx | typeof db = db,
): Promise<boolean> {
    const row = await tx.query.dossierIssueReports.findFirst({
        where: and(
            eq(dossierIssueReports.dossierId, dossierId),
            inArray(dossierIssueReports.status, [...BLOCKING_ISSUE_REPORT_STATUSES]),
        ),
        columns: { id: true },
    });
    return !!row;
}

async function hasRemainingEscalatedIssueReports(
    dossierId: string,
    tx: DbTx,
    excludeReportId?: string,
): Promise<boolean> {
    const rows = await tx.query.dossierIssueReports.findMany({
        where: and(
            eq(dossierIssueReports.dossierId, dossierId),
            eq(dossierIssueReports.status, IssueReportStatus.ESCALATED),
        ),
        columns: { id: true },
    });
    return rows.some((row) => row.id !== excludeReportId);
}

const DOSSIER_STATUSES_RESUME_MAKER_REWORK = [
    DossierStatus.WAITING_CHECKER_1,
    DossierStatus.CHECKER_1_PROCESSING,
] as const;

function validateRejectFieldsInput(rejectFields?: string[] | null) {
    if (rejectFields == null || rejectFields.length === 0) {
        return;
    }
    for (const field of rejectFields) {
        if (!field.includes(".") && !field.endsWith(".*")) {
            throw httpError.badRequest(
                `Invalid reject field "${field}": expected GROUP.FIELD or GROUP.*`,
            );
        }
    }
}

async function reopenReporterAssignmentOnIssueReject(
    tx: DbTx,
    input: {
        reporterAssignmentId: string;
        rejectFields?: string[] | null;
        now: Date;
    },
): Promise<boolean> {
    const assignment = await tx.query.dossierAssignments.findFirst({
        where: eq(dossierAssignments.id, input.reporterAssignmentId),
        columns: {
            id: true,
            role: true,
            status: true,
            allowedFields: true,
        },
    });

    if (!assignment || assignment.role !== WorkerRole.MAKER) {
        return false;
    }
    if (assignment.status !== AssignmentStatus.COMPLETED) {
        return false;
    }

    const allowedFields = parseAllowedFields(assignment.allowedFields);
    const selectiveReject = input.rejectFields != null && input.rejectFields.length > 0;
    const makerRejectFields = selectiveReject
        ? filterRejectFieldsForAssignment(input.rejectFields!, allowedFields)
        : null;

    await tx
        .update(dossierAssignments)
        .set({
            status: AssignmentStatus.IN_PROGRESS,
            attemptNumber: sql`${dossierAssignments.attemptNumber} + 1`,
            completedAt: null,
            assignedAt: input.now,
            metadataKey: null,
            rejectFields: serializeRejectFields(
                selectiveReject && makerRejectFields!.length === 0
                    ? null
                    : makerRejectFields,
            ),
        })
        .where(eq(dossierAssignments.id, assignment.id));

    return true;
}

async function resumeDossierForMakerRework(
    tx: DbTx,
    dossierId: string,
    fromStatus: DossierStatusType,
    now: Date,
): Promise<DossierStatusType> {
    if (!DOSSIER_STATUSES_RESUME_MAKER_REWORK.includes(
        fromStatus as (typeof DOSSIER_STATUSES_RESUME_MAKER_REWORK)[number],
    )) {
        return fromStatus;
    }

    const [updated] = await tx
        .update(dossiers)
        .set({
            status: DossierStatus.ENTRY_PROCESSING,
            updatedAt: now,
        })
        .where(activeDossierWhere(
            eq(dossiers.id, dossierId),
            eq(dossiers.status, fromStatus),
        ))
        .returning({ status: dossiers.status });

    return updated?.status ?? fromStatus;
}

export const IssueReportService = {
    async createOnMakerSubmit(
        tx: DbTx,
        input: {
            dossierId: string;
            reporterId: string;
            reporterAssignmentId: string;
            issueReport: IssueReportInput;
            /** Hồ sơ không có cấp duyệt — gửi thẳng quản lý dự án thay vì CHECKER_1. */
            directToProjectManager?: boolean;
        },
    ) {
        const existing = await getOpenIssueReportForAssignment(
            input.reporterAssignmentId,
            tx,
        );
        if (existing) {
            throw httpError.conflict("Phân công này đã có thông báo vấn đề đang mở");
        }

        const directToPm = input.directToProjectManager === true;
        const managerId = directToPm
            ? await resolveProjectManagerId(input.dossierId, tx)
            : null;

        const [row] = await tx.insert(dossierIssueReports).values({
            dossierId: input.dossierId,
            reporterId: input.reporterId,
            reporterAssignmentId: input.reporterAssignmentId,
            targetRole: WorkerRole.CHECKER_1,
            status: directToPm ? IssueReportStatus.ESCALATED : IssueReportStatus.PENDING,
            type: input.issueReport.type,
            notes: input.issueReport.notes,
            escalatedToId: managerId,
        }).returning();

        await insertIssueWorkflowLog(tx, {
            dossierId: input.dossierId,
            actorId: input.reporterId,
            action: directToPm
                ? "ISSUE_REPORT_SUBMITTED_TO_PM"
                : "ISSUE_REPORT_SUBMITTED",
            notes: input.issueReport.notes,
        });

        return toResponse(row);
    },

    async listOpenForDossier(dossierId: string): Promise<IssueReportResponse[]> {
        const rows = await db.query.dossierIssueReports.findMany({
            where: and(
                eq(dossierIssueReports.dossierId, dossierId),
                inArray(dossierIssueReports.status, [...OPEN_ISSUE_REPORT_STATUSES]),
            ),
            orderBy: desc(dossierIssueReports.createdAt),
            with: {
                reporter: {
                    columns: { fullName: true },
                },
            },
        });
        return rows.map((row) => toResponse(row, row.reporter?.fullName ?? null));
    },

    /** Trả danh sách tất cả issue reports của 1 assignment (bao gồm cả REJECTED để maker thấy lý do bị từ chối). */
    async listForAssignment(reporterAssignmentId: string): Promise<IssueReportResponse[]> {
        const rows = await db.query.dossierIssueReports.findMany({
            where: eq(dossierIssueReports.reporterAssignmentId, reporterAssignmentId),
            orderBy: desc(dossierIssueReports.createdAt),
            with: {
                reporter: {
                    columns: { fullName: true },
                },
            },
        });
        return rows.map((row) => toResponse(row, row.reporter?.fullName ?? null));
    },

    async listOpenForDossiers(
        dossierIds: string[],
    ): Promise<Map<string, IssueReportResponse[]>> {
        const uniqueIds = [...new Set(dossierIds)];
        if (uniqueIds.length === 0) {
            return new Map();
        }

        const rows = await db.query.dossierIssueReports.findMany({
            where: and(
                inArray(dossierIssueReports.dossierId, uniqueIds),
                inArray(dossierIssueReports.status, [...OPEN_ISSUE_REPORT_STATUSES]),
            ),
            orderBy: desc(dossierIssueReports.createdAt),
        });

        const byDossierId = new Map<string, IssueReportResponse[]>();
        for (const row of rows) {
            const list = byDossierId.get(row.dossierId) ?? [];
            list.push(toResponse(row));
            byDossierId.set(row.dossierId, list);
        }
        return byDossierId;
    },

    async assertCheckerNotBlocked(dossierId: string, checkerStep: number) {
        if (checkerStep !== 1) {
            return;
        }

        const blocked = await hasBlockingIssueReportsForDossier(dossierId);
        if (blocked) {
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

        validateRejectFieldsInput(rejectFields);

        const now = new Date();
        const result = await db.transaction(async (tx) => {
            const dossier = await tx.query.dossiers.findFirst({
                where: activeDossierWhere(eq(dossiers.id, row.dossierId)),
                columns: { id: true, status: true, rejectCount: true, currentQcStep: true },
            });

            if (!dossier) {
                throw httpError.notFound("Dossier not found");
            }

            const fromStatus = dossier.status;

            const [updatedReport] = await tx.update(dossierIssueReports)
                .set({
                    status: IssueReportStatus.REJECTED,
                    resolvedById: actorId,
                    resolvedAt: now,
                    resolveNotes: notes,
                    updatedAt: now,
                })
                .where(and(
                    eq(dossierIssueReports.id, reportId),
                    eq(dossierIssueReports.status, IssueReportStatus.PENDING),
                ))
                .returning();

            if (!updatedReport) {
                throw httpError.conflict("Thông báo đã được xử lý");
            }

            const reopenedMaker = await reopenReporterAssignmentOnIssueReject(tx, {
                reporterAssignmentId: row.reporterAssignmentId,
                rejectFields,
                now,
            });

            const dossierStatusAfter = reopenedMaker
                ? await resumeDossierForMakerRework(tx, row.dossierId, fromStatus, now)
                : fromStatus;

            await tx.insert(workflowLogs).values({
                dossierId: row.dossierId,
                actorId,
                action: "ISSUE_REPORT_REJECTED",
                fromStatus,
                toStatus: dossierStatusAfter,
                notes,
            });

            return { updatedReport, dossierStatusAfter, reopenedMaker, dossier };
        });

        return {
            issueReport: toResponse(result.updatedReport),
            reject: {
                dossierId: row.dossierId,
                assignmentId: row.reporterAssignmentId,
                dossierStatus: result.dossierStatusAfter,
                rejectCount: result.dossier.rejectCount,
                rejectedQcStep: result.dossier.currentQcStep + 1,
                reopenedRoles: result.reopenedMaker ? [WorkerRole.MAKER] : [],
                reopenedMakerCount: result.reopenedMaker ? 1 : 0,
                rejectFields: rejectFields ?? null,
            },
        };
    },

    async escalate(reportId: string, actorId: string) {
        const row = await IssueReportService.getByIdOrThrow(reportId);

        if (row.status !== IssueReportStatus.PENDING) {
            throw httpError.conflict("Chỉ có thể chuyển tiếp thông báo đang chờ xử lý");
        }

        const managerId = await resolveProjectManagerId(row.dossierId, db);
        const now = new Date();

        const updated = await db.transaction(async (tx) => {
            const dossier = await tx.query.dossiers.findFirst({
                where: activeDossierWhere(eq(dossiers.id, row.dossierId)),
                columns: { id: true, status: true },
            });

            if (!dossier) {
                throw httpError.notFound("Dossier not found");
            }

            const fromStatus = dossier.status;

            const [dossierRow] = await tx
                .update(dossiers)
                .set({
                    status: DossierStatus.WAITING_ISSUE_RESOLUTION,
                    updatedAt: now,
                })
                .where(activeDossierWhere(eq(dossiers.id, row.dossierId)))
                .returning({ id: dossiers.id });

            if (!dossierRow) {
                throw httpError.notFound("Dossier not found");
            }

            const [reportRow] = await tx.update(dossierIssueReports)
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

            if (!reportRow) {
                throw httpError.conflict("Thông báo đã được xử lý");
            }

            await tx.insert(workflowLogs).values({
                dossierId: row.dossierId,
                actorId,
                action: "ISSUE_REPORT_ESCALATED",
                fromStatus,
                toStatus: DossierStatus.WAITING_ISSUE_RESOLUTION,
                notes: row.notes,
            });

            return reportRow;
        });

        return toResponse(updated);
    },

    async closeByProjectManager(reportId: string, actorId: string, notes?: string | null) {
        const row = await IssueReportService.getByIdOrThrow(reportId);

        if (row.status !== IssueReportStatus.ESCALATED) {
            throw httpError.conflict("Chỉ có thể đóng thông báo đã chuyển tiếp");
        }

        if (row.escalatedToId !== actorId) {
            throw httpError.forbidden("Bạn không phải quản lý dự án được chuyển tiếp");
        }

        const now = new Date();
        const result = await db.transaction(async (tx) => {
            const [updated] = await tx.update(dossierIssueReports)
                .set({
                    status: IssueReportStatus.CLOSED,
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

            const dossier = await tx.query.dossiers.findFirst({
                where: activeDossierWhere(eq(dossiers.id, row.dossierId)),
                columns: {
                    id: true,
                    status: true,
                    requiredQcCount: true,
                    currentQcStep: true,
                },
            });

            let dossierApproved = false;
            let dossierStatusAfterClose: DossierStatusType | null = dossier?.status ?? null;

            if (dossier?.status === DossierStatus.WAITING_ISSUE_RESOLUTION) {
                const hasOtherEscalated = await hasRemainingEscalatedIssueReports(
                    row.dossierId,
                    tx,
                    updated.id,
                );

                if (!hasOtherEscalated) {
                    if (dossier.requiredQcCount === 0) {
                        const [approvedRow] = await tx
                            .update(dossiers)
                            .set({
                                status: DossierStatus.APPROVED,
                                updatedAt: now,
                            })
                            .where(activeDossierWhere(
                                eq(dossiers.id, dossier.id),
                                eq(dossiers.status, DossierStatus.WAITING_ISSUE_RESOLUTION),
                            ))
                            .returning({ id: dossiers.id });

                        if (approvedRow) {
                            dossierApproved = true;
                            dossierStatusAfterClose = DossierStatus.APPROVED;
                            await tx.insert(workflowLogs).values({
                                dossierId: dossier.id,
                                actorId,
                                action: "APPROVE_AFTER_ISSUE_RESOLVED",
                                fromStatus: DossierStatus.WAITING_ISSUE_RESOLUTION,
                                toStatus: DossierStatus.APPROVED,
                                notes: notes ?? row.notes,
                            });
                        }
                    } else {
                        const resumedStatus = await resolveCheckerResumeStatus(
                            tx,
                            dossier.id,
                            dossier.currentQcStep,
                        );

                        const [resumedRow] = await tx
                            .update(dossiers)
                            .set({
                                status: resumedStatus,
                                updatedAt: now,
                            })
                            .where(activeDossierWhere(
                                eq(dossiers.id, dossier.id),
                                eq(dossiers.status, DossierStatus.WAITING_ISSUE_RESOLUTION),
                            ))
                            .returning({ id: dossiers.id });

                        if (resumedRow) {
                            dossierStatusAfterClose = resumedStatus;
                            await tx.insert(workflowLogs).values({
                                dossierId: dossier.id,
                                actorId,
                                action: "RESUME_CHECKER_AFTER_ISSUE_RESOLVED",
                                fromStatus: DossierStatus.WAITING_ISSUE_RESOLUTION,
                                toStatus: resumedStatus,
                                notes: notes ?? row.notes,
                            });
                        }
                    }
                }
            }

            await tx.insert(workflowLogs).values({
                dossierId: row.dossierId,
                actorId,
                action: "ISSUE_REPORT_PM_CLOSED",
                fromStatus: dossier?.status ?? null,
                toStatus: dossierStatusAfterClose,
                notes: notes ?? row.notes,
            });

            return { updated, dossierApproved, dossierId: row.dossierId };
        });

        if (result.dossierApproved) {
            const { generateAndPersistAip } = await import(
                "../../libs/archival-package/aip-service.ts"
            );
            generateAndPersistAip({ dossierId: result.dossierId }).catch((err) => {
                console.error("[AIP] Failed to generate archival package after PM close:", err);
            });
        }

        return {
            ...toResponse(result.updated),
            dossierApproved: result.dossierApproved,
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
            ...toResponse(row, row.reporter?.fullName ?? null),
            dossierName: row.dossier?.name ?? null,
            dossierStatus: row.dossier?.status ?? null,
            projectCode: row.dossier?.projectCode ?? null,
        }));
    },

    async closeConfirmedOnCheckerApprove(tx: DbTx, dossierId: string) {
        const now = new Date();
        await tx.update(dossierIssueReports)
            .set({
                status: IssueReportStatus.CLOSED,
                updatedAt: now,
            })
            .where(and(
                eq(dossierIssueReports.dossierId, dossierId),
                eq(dossierIssueReports.status, IssueReportStatus.CONFIRMED),
            ));
    },

    /**
     * Đóng các issue CONFIRMED của những maker bị reset về IN_PROGRESS khi QC reject metadata.
     * Tránh tình trạng maker đã làm lại từ đầu nhưng issue CONFIRMED cũ vẫn còn mở.
     */
    async closeConfirmedForResetMakers(
        tx: DbTx,
        resetMakerAssignmentIds: string[],
    ) {
        if (resetMakerAssignmentIds.length === 0) {
            return;
        }

        const now = new Date();
        await tx.update(dossierIssueReports)
            .set({
                status: IssueReportStatus.CLOSED,
                updatedAt: now,
            })
            .where(and(
                inArray(dossierIssueReports.reporterAssignmentId, resetMakerAssignmentIds),
                eq(dossierIssueReports.status, IssueReportStatus.CONFIRMED),
            ));
    },

    /**
     * Trả về Set các reporterAssignmentId có issue CONFIRMED đang mở.
     * Dùng để waiver đúng maker (không waiver toàn bộ) khi checker sửa metadata.
     */
    async getConfirmedWaivedAssignmentIds(
        tx: DbTx,
        dossierId: string,
    ): Promise<Set<string>> {
        const rows = await tx.query.dossierIssueReports.findMany({
            where: and(
                eq(dossierIssueReports.dossierId, dossierId),
                eq(dossierIssueReports.status, IssueReportStatus.CONFIRMED),
            ),
            columns: { reporterAssignmentId: true },
        });
        return new Set(rows.map((r) => r.reporterAssignmentId));
    },
};

export {
    getOpenIssueReportsForDossier,
    hasBlockingIssueReportsForDossier,
    toResponse as toIssueReportResponse,
};
