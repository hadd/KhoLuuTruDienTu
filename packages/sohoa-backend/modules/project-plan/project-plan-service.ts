import { httpError } from "@shared/common-lib";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Static } from "elysia";
import { db } from "../../db/db-conn.ts";
import { projectPlans } from "../../db/schemas/project-plan.ts";
import { projects } from "../../db/schemas/project.ts";
import { paperPlans } from "../../db/schemas/paper-plans.ts";
import { ProjectService } from "../project/project-service.ts";
import {
    createProjectPlanBodySchema,
    updateProjectPlanBodySchema,
    bulkUpdatePlanDetailBodySchema,
} from "./types.ts";
import { planDetails } from "../../db/schemas/plan-details.ts";

function mapProjectPlan(row: typeof projectPlans.$inferSelect & { paperPlans?: Array<{ paperSizeId: string; quantity: number; paperSize?: { name: string } }> }) {
    const pageTotal = row.paperPlans ? row.paperPlans.reduce((sum, p) => sum + p.quantity, 0) : 0;

    return {
        id: row.id,
        name: row.name,
        projectCode: row.projectCode,
        dossierCount: row.dossierCount,
        dateCount: row.dateCount,
        isActive: row.isActive,
        startDate: row.startDate,
        endDate: row.endDate,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        pageTotal,
        ...(row.paperPlans !== undefined ? { paperPlans: row.paperPlans } : {}),
    };
}

function mapPlanDetail(row: typeof planDetails.$inferSelect) {
    return {
        id: row.id,
        planId: row.planId,
        taskName: row.taskName,
        quantity: row.quantity,
        unit: row.unit,
        quota: row.quota,
        dateCount: row.dateCount,
        workerCount: row.workerCount,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

async function getActivePlanOrThrow(id: string) {
    const row = await db.query.projectPlans.findFirst({
        where: and(
            eq(projectPlans.id, id),
            isNull(projectPlans.deletedAt),
        ),
    });

    if (!row) {
        throw httpError.notFound("Project plan not found");
    }

    return row;
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

function assertPlanDatesWithinProject(input: {
    startDate: string;
    endDate: string;
    projectStartDate: string | null;
    projectEndDate: string | null;
}) {
    const { startDate, endDate, projectStartDate, projectEndDate } = input;

    if (startDate > endDate) {
        throw httpError.badRequest("startDate must be before or equal to endDate");
    }

    if (projectStartDate) {
        if (startDate < projectStartDate) {
            throw httpError.badRequest(
                "Plan startDate must be on or after project startDate",
            );
        }
        if (endDate < projectStartDate) {
            throw httpError.badRequest(
                "Plan endDate must be on or after project startDate",
            );
        }
    }

    if (projectEndDate) {
        if (startDate > projectEndDate) {
            throw httpError.badRequest(
                "Plan startDate must be on or before project acceptanceDate",
            );
        }
        if (endDate > projectEndDate) {
            throw httpError.badRequest(
                "Plan endDate must be on or before project acceptanceDate",
            );
        }
    }
}

export const ProjectPlanService = {
    async list(input?: {
        projectCode?: string;
        projectCodes?: string[];
        page?: number;
        limit?: number;
    }) {
        const page = input?.page && input.page > 0 ? input.page : 1;
        const limit = Math.min(input?.limit ?? 50, 200);
        const offset = (page - 1) * limit;

        if (input?.projectCode) {
            await ProjectService.assertProjectExists(input.projectCode);
        }

        const conditions = [isNull(projectPlans.deletedAt)];
        if (input?.projectCode) {
            conditions.push(eq(projectPlans.projectCode, input.projectCode));
        } else if (input?.projectCodes?.length) {
            conditions.push(inArray(projectPlans.projectCode, input.projectCodes));
        } else if (input?.projectCodes && input.projectCodes.length === 0) {
            conditions.push(sql`false`);
        }

        const totalResult = await db.select({ count: sql`count(*)`.mapWith(Number) })
            .from(projectPlans)
            .where(and(...conditions));
        const total = totalResult[0].count;
        const totalPages = Math.ceil(total / limit);
        const hasNextPage = page < totalPages;
        const hasPreviousPage = page > 1;

        const rows = await db.query.projectPlans.findMany({
            where: and(...conditions),
            orderBy: [desc(projectPlans.updatedAt)],
            limit,
            offset,
            with: {
                project: {
                    columns: { projectCode: true, projectName: true },
                },
                paperPlans: {
                    where: isNull(paperPlans.deletedAt),
                    columns: { paperSizeId: true, quantity: true },
                    with: {
                        paperSize: {
                            columns: { name: true },
                        },
                    },
                },
            },
        });

        return {
            items: rows.map((row) => ({
                ...mapProjectPlan(row),
                project: row.project,
            })),
            page,
            limit,
            total,
            totalPages,
            hasNextPage,
            hasPreviousPage,
        };
    },

    async get(id: string) {
        const row = await db.query.projectPlans.findFirst({
            where: and(
                eq(projectPlans.id, id),
                isNull(projectPlans.deletedAt),
            ),
            with: {
                project: {
                    columns: { projectCode: true, projectName: true },
                },
                paperPlans: {
                    where: isNull(paperPlans.deletedAt),
                    columns: { paperSizeId: true, quantity: true },
                },
            },
        });

        if (!row) {
            throw httpError.notFound("Project plan not found");
        }

        return {
            ...mapProjectPlan(row),
            project: row.project,
        };
    },

    async create(body: Static<typeof createProjectPlanBodySchema>) {
        const project = await getActiveProjectOrThrow(body.projectCode);

        assertPlanDatesWithinProject({
            startDate: body.startDate,
            endDate: body.endDate,
            projectStartDate: project.startDate,
            projectEndDate: project.acceptanceDate,
        });

        const startDateMs = new Date(body.startDate).getTime();
        const endDateMs = new Date(body.endDate).getTime();
        const daysDiff = Math.floor((endDateMs - startDateMs) / 86400000);
        const dateCount = body.dateCount ?? 0;
        if (dateCount > daysDiff) {
            throw httpError.badRequest(`dateCount (${dateCount}) cannot exceed endDate - startDate (${daysDiff} days)`);
        }

        return await db.transaction(async (tx) => {
            const [inserted] = await tx
                .insert(projectPlans)
                .values({
                    name: body.name,
                    projectCode: body.projectCode,
                    dossierCount: body.dossierCount ?? 0,
                    dateCount: body.dateCount ?? 0,
                    isActive: body.isActive ?? true,
                    startDate: body.startDate,
                    endDate: body.endDate,
                })
                .returning();

            if (body.paperPlans && body.paperPlans.length > 0) {
                const paperPlanValues = body.paperPlans.map((p) => ({
                    planId: inserted!.id,
                    paperSizeId: p.paperSizeId,
                    quantity: p.quantity,
                }));
                await tx.insert(paperPlans).values(paperPlanValues);
            }

            return mapProjectPlan(inserted!);
        });
    },

    async update(id: string, body: Static<typeof updateProjectPlanBodySchema>) {
        const current = await getActivePlanOrThrow(id);
        const projectCode = body.projectCode ?? current.projectCode;
        const project = await getActiveProjectOrThrow(projectCode);

        const startDate = body.startDate ?? current.startDate;
        const endDate = body.endDate ?? current.endDate;

        assertPlanDatesWithinProject({
            startDate,
            endDate,
            projectStartDate: project.startDate,
            projectEndDate: project.acceptanceDate,
        });

        const startDateMs = new Date(startDate).getTime();
        const endDateMs = new Date(endDate).getTime();
        const daysDiff = Math.floor((endDateMs - startDateMs) / 86400000);
        const dateCount = body.dateCount ?? current.dateCount;
        if (dateCount > daysDiff) {
            throw httpError.badRequest(`dateCount (${dateCount}) cannot exceed endDate - startDate (${daysDiff} days)`);
        }

        const patch: Partial<typeof projectPlans.$inferInsert> = {
            updatedAt: new Date(),
        };

        if (body.name !== undefined) patch.name = body.name;
        if (body.projectCode !== undefined) patch.projectCode = body.projectCode;
        if (body.dossierCount !== undefined) patch.dossierCount = body.dossierCount;
        if (body.dateCount !== undefined) patch.dateCount = body.dateCount;
        if (body.isActive !== undefined) patch.isActive = body.isActive;
        if (body.startDate !== undefined) patch.startDate = body.startDate;
        if (body.endDate !== undefined) patch.endDate = body.endDate;

        return await db.transaction(async (tx) => {
            const [updated] = await tx
                .update(projectPlans)
                .set(patch)
                .where(and(
                    eq(projectPlans.id, id),
                    isNull(projectPlans.deletedAt),
                ))
                .returning();

            if (body.paperPlans !== undefined) {
                const incomingSizeIds = new Set(body.paperPlans.map(p => p.paperSizeId));

                const currentActive = await tx.query.paperPlans.findMany({
                    where: and(
                        eq(paperPlans.planId, id),
                        isNull(paperPlans.deletedAt)
                    )
                });

                const toDeleteSizeIds = currentActive
                    .filter(p => !incomingSizeIds.has(p.paperSizeId))
                    .map(p => p.paperSizeId);

                if (toDeleteSizeIds.length > 0) {
                    await tx.update(paperPlans)
                        .set({ deletedAt: new Date(), updatedAt: new Date() })
                        .where(and(
                            eq(paperPlans.planId, id),
                            inArray(paperPlans.paperSizeId, toDeleteSizeIds)
                        ));
                }

                for (const item of body.paperPlans) {
                    await tx.insert(paperPlans).values({
                        planId: id,
                        paperSizeId: item.paperSizeId,
                        quantity: item.quantity,
                        deletedAt: null
                    }).onConflictDoUpdate({
                        target: [paperPlans.planId, paperPlans.paperSizeId],
                        set: {
                            quantity: item.quantity,
                            deletedAt: null,
                            updatedAt: new Date()
                        }
                    });
                }
            }

            return mapProjectPlan(updated!);
        });
    },

    async delete(id: string) {
        await getActivePlanOrThrow(id);

        await db
            .update(projectPlans)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(eq(projectPlans.id, id));

        return { id, deleted: true as const };
    },

    async getDetails(planId: string) {
        await getActivePlanOrThrow(planId);
        const rows = await db.query.planDetails.findMany({
            where: and(
                eq(planDetails.planId, planId),
                isNull(planDetails.deletedAt),
            ),
            orderBy: [desc(planDetails.createdAt)],
        });
        return rows.map(mapPlanDetail);
    },

    async bulkUpdateDetails(planId: string, body: Static<typeof bulkUpdatePlanDetailBodySchema>) {
        const plan = await getActivePlanOrThrow(planId);

        for (const item of body.details) {
            const detailDateCount = item.dateCount ?? 0;
            if (detailDateCount > plan.dateCount) {
                throw httpError.badRequest(`Plan detail dateCount (${detailDateCount}) cannot exceed project plan dateCount (${plan.dateCount})`);
            }
        }

        const currentDetails = await db.query.planDetails.findMany({
            where: and(
                eq(planDetails.planId, planId),
                isNull(planDetails.deletedAt),
            ),
        });

        const incomingIds = new Set(body.details.map(d => d.id).filter(Boolean));
        const toDeleteIds = currentDetails.filter(d => !incomingIds.has(d.id)).map(d => d.id);

        if (toDeleteIds.length > 0) {
            await db.update(planDetails)
                .set({ deletedAt: new Date(), updatedAt: new Date() })
                .where(inArray(planDetails.id, toDeleteIds));
        }

        const toInsert = [];
        for (const item of body.details) {
            if (item.id) {
                await db.update(planDetails).set({
                    taskName: item.taskName,
                    quantity: item.quantity ?? 0,
                    unit: item.unit,
                    quota: item.quota ?? 0,
                    dateCount: item.dateCount ?? 0,
                    workerCount: item.workerCount ?? 0,
                    updatedAt: new Date(),
                }).where(eq(planDetails.id, item.id));
            } else {
                toInsert.push({
                    planId,
                    taskName: item.taskName,
                    quantity: item.quantity ?? 0,
                    unit: item.unit,
                    quota: item.quota ?? 0,
                    dateCount: item.dateCount ?? 0,
                    workerCount: item.workerCount ?? 0,
                });
            }
        }

        if (toInsert.length > 0) {
            await db.insert(planDetails).values(toInsert);
        }

        return await ProjectPlanService.getDetails(planId);
    },
};
