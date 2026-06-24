import { httpError } from "@shared/common-lib";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Static } from "elysia";
import { db } from "../../db/db-conn.ts";
import { projectPlans } from "../../db/schemas/project-plan.ts";
import { projects } from "../../db/schemas/project.ts";
import { ProjectService } from "../project/project-service.ts";
import {
    createProjectPlanBodySchema,
    updateProjectPlanBodySchema,
} from "./types.ts";

function mapProjectPlan(row: typeof projectPlans.$inferSelect) {
    return {
        id: row.id,
        name: row.name,
        projectCode: row.projectCode,
        a4Pages: row.a4Pages,
        a3Pages: row.a3Pages,
        dossierCount: row.dossierCount,
        quota: row.quota,
        startDate: row.startDate,
        endDate: row.endDate,
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
    async list(input?: { projectCode?: string; limit?: number; offset?: number }) {
        const limit = Math.min(input?.limit ?? 50, 200);
        const offset = input?.offset ?? 0;

        if (input?.projectCode) {
            await ProjectService.assertProjectExists(input.projectCode);
        }

        const conditions = [isNull(projectPlans.deletedAt)];
        if (input?.projectCode) {
            conditions.push(eq(projectPlans.projectCode, input.projectCode));
        }

        const rows = await db.query.projectPlans.findMany({
            where: and(...conditions),
            orderBy: [desc(projectPlans.updatedAt)],
            limit,
            offset,
            with: {
                project: {
                    columns: { projectCode: true, projectName: true },
                },
            },
        });

        return {
            items: rows.map((row) => ({
                ...mapProjectPlan(row),
                project: row.project,
            })),
            limit,
            offset,
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

        const [inserted] = await db
            .insert(projectPlans)
            .values({
                name: body.name,
                projectCode: body.projectCode,
                a4Pages: body.a4Pages ?? 0,
                a3Pages: body.a3Pages ?? 0,
                dossierCount: body.dossierCount ?? 0,
                quota: body.quota ?? null,
                startDate: body.startDate,
                endDate: body.endDate,
            })
            .returning();

        return mapProjectPlan(inserted!);
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

        const patch: Partial<typeof projectPlans.$inferInsert> = {
            updatedAt: new Date(),
        };

        if (body.name !== undefined) patch.name = body.name;
        if (body.projectCode !== undefined) patch.projectCode = body.projectCode;
        if (body.a4Pages !== undefined) patch.a4Pages = body.a4Pages;
        if (body.a3Pages !== undefined) patch.a3Pages = body.a3Pages;
        if (body.dossierCount !== undefined) patch.dossierCount = body.dossierCount;
        if (body.quota !== undefined) patch.quota = body.quota;
        if (body.startDate !== undefined) patch.startDate = body.startDate;
        if (body.endDate !== undefined) patch.endDate = body.endDate;

        const [updated] = await db
            .update(projectPlans)
            .set(patch)
            .where(and(
                eq(projectPlans.id, id),
                isNull(projectPlans.deletedAt),
            ))
            .returning();

        return mapProjectPlan(updated!);
    },

    async delete(id: string) {
        await getActivePlanOrThrow(id);

        await db
            .update(projectPlans)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(eq(projectPlans.id, id));

        return { id, deleted: true as const };
    },
};
