import { httpError } from "@shared/common-lib";
import { and, desc, eq, inArray, isNull, max, sql } from "drizzle-orm";
import type { Static } from "elysia";
import { db } from "../../db/db-conn.ts";
import { dossiers } from "../../db/schemas/dossier.ts";
import { projectProgressHistories } from "../../db/schemas/project-progress-history.ts";
import { ProjectStatus } from "../../db/schemas/project-constants.ts";
import { projects } from "../../db/schemas/project.ts";
import { activeDossierWhere } from "../dossier/active-query-filters.ts";
import { projectAccessHelper } from "../auth/project-access-helper.ts";
import {
    createProjectBodySchema,
    updateProjectBodySchema,
} from "./types.ts";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type ProjectRow = typeof projects.$inferSelect;
type ProjectManagerRow = { fullName: string | null } | null | undefined;

function mapProject(row: ProjectRow, manager?: ProjectManagerRow) {
    return {
        projectCode: row.projectCode,
        projectName: row.projectName,
        projectType: row.projectType,
        investor: row.investor,
        startDate: row.startDate,
        acceptanceDate: row.acceptanceDate,
        totalInvestment: row.totalInvestment,
        status: row.status,
        managerId: row.managerId,
        managerName: manager?.fullName?.trim() || null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
    };
}

async function findProjectWithManager(projectCode: string) {
    return await db.query.projects.findFirst({
        where: and(
            eq(projects.projectCode, projectCode),
            isNull(projects.deletedAt),
        ),
        with: {
            manager: {
                columns: { fullName: true },
            },
        },
    });
}

function mapProgressHistory(row: typeof projectProgressHistories.$inferSelect) {
    return {
        id: row.id,
        projectCode: row.projectCode,
        extensionNumber: row.extensionNumber,
        previousAcceptanceDate: row.previousAcceptanceDate,
        newAcceptanceDate: row.newAcceptanceDate,
        changeReason: row.changeReason,
        updatedBy: row.updatedBy,
        recordedAt: row.recordedAt,
    };
}

function datesEqual(a: string | null | undefined, b: string | null | undefined): boolean {
    const left = a ?? null;
    const right = b ?? null;
    return left === right;
}

async function getActiveProjectOrThrow(projectCode: string) {
    const row = await db.query.projects.findFirst({
        where: and(
            eq(projects.projectCode, projectCode),
            isNull(projects.deletedAt),
        ),
    });

    if (!row) {
        throw httpError.notFound(`Project not found: ${projectCode}`);
    }

    return row;
}

async function getNextExtensionNumber(tx: DbTx, projectCode: string): Promise<number> {
    const [row] = await tx
        .select({ maxExt: max(projectProgressHistories.extensionNumber) })
        .from(projectProgressHistories)
        .where(eq(projectProgressHistories.projectCode, projectCode));

    return (row?.maxExt ?? 0) + 1;
}

export const ProjectService = {
    async assertProjectExists(projectCode: string) {
        await getActiveProjectOrThrow(projectCode);
    },

    async list(input?: {
        status?: string;
        search?: string;
        limit?: number;
        page?: number;
        offset?: number;
        projectCodes?: string[];
    }) {
        const limit = Math.min(input?.limit ?? 50, 200);
        const page = input?.page && input.page > 0
            ? input.page
            : Math.floor((input?.offset ?? 0) / limit) + 1;
        const offset = (page - 1) * limit;

        const emptyResult = {
            items: [] as ReturnType<typeof mapProject>[],
            page,
            limit,
            total: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: page > 1,
        };

        const conditions = [isNull(projects.deletedAt)];
        if (input?.status) {
            conditions.push(eq(projects.status, input.status));
        }
        if (input?.projectCodes !== undefined) {
            if (input.projectCodes.length === 0) {
                return emptyResult;
            }
            conditions.push(inArray(projects.projectCode, input.projectCodes));
        }
        if (input?.search?.trim()) {
            const term = `%${input.search.trim()}%`;
            conditions.push(
                sql`(${projects.projectCode} ILIKE ${term} OR ${projects.projectName} ILIKE ${term})`,
            );
        }

        const where = and(...conditions);

        const [countRow] = await db
            .select({ count: sql<number>`cast(count(*) as int)` })
            .from(projects)
            .where(where);
        const total = countRow?.count ?? 0;

        const rows = await db.query.projects.findMany({
            where,
            orderBy: [desc(projects.updatedAt)],
            limit,
            offset,
            with: {
                manager: {
                    columns: { fullName: true },
                },
            },
        });

        const totalPages = Math.max(Math.ceil(total / limit), 1);

        return {
            items: rows.map((row) => mapProject(row, row.manager)),
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
        };
    },

    async listOptions(input?: {
        search?: string;
        limit?: number;
        offset?: number;
        projectCodes?: string[];
    }) {
        const result = await ProjectService.list(input);
        return {
            items: result.items.map((project) => ({
                projectCode: project.projectCode,
                projectName: project.projectName,
            })),
            limit: result.limit,
        };
    },

    async get(projectCode: string) {
        const row = await findProjectWithManager(projectCode);
        if (!row) {
            throw httpError.notFound(`Project not found: ${projectCode}`);
        }

        const [countRow] = await db
            .select({ count: max(projectProgressHistories.extensionNumber) })
            .from(projectProgressHistories)
            .where(eq(projectProgressHistories.projectCode, projectCode));

        return {
            ...mapProject(row, row.manager),
            extensionCount: countRow?.count ?? 0,
        };
    },

    async create(
        body: Static<typeof createProjectBodySchema>,
        options?: { actorManagerId?: string },
    ) {
        const existing = await db.query.projects.findFirst({
            where: eq(projects.projectCode, body.projectCode),
        });

        if (existing && !existing.deletedAt) {
            throw httpError.conflict(`Project code already exists: ${body.projectCode}`);
        }

        const managerId = options?.actorManagerId ?? body.managerId ?? null;
        if (managerId) {
            await projectAccessHelper.assertValidProjectManager(managerId);
        }

        const [inserted] = await db
            .insert(projects)
            .values({
                projectCode: body.projectCode,
                projectName: body.projectName,
                projectType: body.projectType ?? null,
                investor: body.investor ?? null,
                startDate: body.startDate ?? null,
                acceptanceDate: body.acceptanceDate ?? null,
                totalInvestment: body.totalInvestment ?? null,
                status: body.status ?? ProjectStatus.IN_PROGRESS,
                managerId,
            })
            .returning();

        const created = await findProjectWithManager(inserted.projectCode);
        return mapProject(
            created ?? inserted,
            created?.manager,
        );
    },

    async update(
        projectCode: string,
        body: Static<typeof updateProjectBodySchema>,
        updatedByUserId: string,
        options?: { allowManagerChange?: boolean },
    ) {
        const current = await getActiveProjectOrThrow(projectCode);

        if (body.managerId !== undefined && !options?.allowManagerChange) {
            throw httpError.forbidden("Only administrators can change the project manager");
        }

        if (body.managerId) {
            await projectAccessHelper.assertValidProjectManager(body.managerId);
        }

        const acceptanceDateChanging = body.acceptanceDate !== undefined
            && !datesEqual(body.acceptanceDate, current.acceptanceDate);

        if (acceptanceDateChanging && !body.changeReason?.trim()) {
            throw httpError.badRequest("changeReason is required when updating acceptanceDate");
        }

        return await db.transaction(async (tx) => {
            if (acceptanceDateChanging) {
                const extensionNumber = await getNextExtensionNumber(tx, projectCode);
                const newAcceptanceDate = body.acceptanceDate!;
                const previousAcceptanceDate = current.acceptanceDate;

                await tx.insert(projectProgressHistories).values({
                    projectCode,
                    extensionNumber,
                    previousAcceptanceDate,
                    newAcceptanceDate,
                    changeReason: body.changeReason!.trim(),
                    updatedBy: updatedByUserId,
                });

                if (
                    previousAcceptanceDate
                    && newAcceptanceDate > previousAcceptanceDate
                    && body.status === undefined
                ) {
                    body = { ...body, status: ProjectStatus.EXTENDED };
                }
            }

            const patch: Partial<typeof projects.$inferInsert> = {
                updatedAt: new Date(),
            };

            if (body.projectName !== undefined) patch.projectName = body.projectName;
            if (body.projectType !== undefined) patch.projectType = body.projectType;
            if (body.investor !== undefined) patch.investor = body.investor;
            if (body.startDate !== undefined) patch.startDate = body.startDate;
            if (body.acceptanceDate !== undefined) patch.acceptanceDate = body.acceptanceDate;
            if (body.totalInvestment !== undefined) patch.totalInvestment = body.totalInvestment;
            if (body.status !== undefined) patch.status = body.status;
            if (body.managerId !== undefined) patch.managerId = body.managerId;

            const [updated] = await tx
                .update(projects)
                .set(patch)
                .where(and(
                    eq(projects.projectCode, projectCode),
                    isNull(projects.deletedAt),
                ))
                .returning();

            if (!updated) {
                throw httpError.notFound(`Project not found: ${projectCode}`);
            }

            const refreshed = await findProjectWithManager(updated.projectCode);
            return mapProject(
                refreshed ?? updated,
                refreshed?.manager,
            );
        });
    },

    async delete(projectCode: string) {
        await getActiveProjectOrThrow(projectCode);

        const linkedDossier = await db.query.dossiers.findFirst({
            where: activeDossierWhere(eq(dossiers.projectCode, projectCode)),
            columns: { id: true },
        });

        if (linkedDossier) {
            throw httpError.conflict("Cannot delete project with active dossiers");
        }

        const [updated] = await db
            .update(projects)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(and(
                eq(projects.projectCode, projectCode),
                isNull(projects.deletedAt),
            ))
            .returning();

        if (!updated) {
            throw httpError.notFound(`Project not found: ${projectCode}`);
        }

        return { projectCode, deleted: true as const };
    },

    async listProgressHistory(projectCode: string) {
        await getActiveProjectOrThrow(projectCode);

        const rows = await db.query.projectProgressHistories.findMany({
            where: eq(projectProgressHistories.projectCode, projectCode),
            orderBy: [desc(projectProgressHistories.extensionNumber)],
        });

        return rows.map(mapProgressHistory);
    },
};
