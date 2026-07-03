import { httpError } from "@shared/common-lib";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Static } from "elysia";
import { db } from "../../db/db-conn.ts";
import { paperPlans } from "../../db/schemas/paper-plans.ts";
import { projectPlans } from "../../db/schemas/project-plan.ts";
import { paperSizes } from "../../db/schemas/paper-size.ts";
import {
    createPaperPlanBodySchema,
    updatePaperPlanBodySchema,
} from "./types.ts";

function mapPaperPlan(row: typeof paperPlans.$inferSelect) {
    return {
        id: row.id,
        planId: row.planId,
        paperSizeId: row.paperSizeId,
        quantity: row.quantity,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

async function getActivePaperPlanOrThrow(id: string) {
    const row = await db.query.paperPlans.findFirst({
        where: and(
            eq(paperPlans.id, id),
            isNull(paperPlans.deletedAt),
        ),
    });

    if (!row) {
        throw httpError.notFound("Paper plan not found");
    }

    return row;
}

export const PaperPlanService = {
    async list(input?: {
        planId?: string;
        planIds?: string[];
        limit?: number;
        offset?: number;
    }) {
        const limit = Math.min(input?.limit ?? 50, 200);
        const offset = input?.offset ?? 0;

        const conditions = [isNull(paperPlans.deletedAt)];
        if (input?.planId) {
            conditions.push(eq(paperPlans.planId, input.planId));
        } else if (input?.planIds?.length) {
            conditions.push(inArray(paperPlans.planId, input.planIds));
        } else if (input?.planIds && input.planIds.length === 0) {
            conditions.push(sql`false`);
        }

        const rows = await db.query.paperPlans.findMany({
            where: and(...conditions),
            orderBy: [desc(paperPlans.updatedAt)],
            limit,
            offset,
            with: {
                paperSize: {
                    columns: { id: true, name: true },
                },
            },
        });

        return {
            items: rows.map((row) => ({
                ...mapPaperPlan(row),
                paperSize: row.paperSize,
            })),
            limit,
            offset,
        };
    },

    async get(id: string) {
        const row = await db.query.paperPlans.findFirst({
            where: and(
                eq(paperPlans.id, id),
                isNull(paperPlans.deletedAt),
            ),
            with: {
                paperSize: {
                    columns: { id: true, name: true },
                },
            },
        });

        if (!row) {
            throw httpError.notFound("Paper plan not found");
        }

        return {
            ...mapPaperPlan(row),
            paperSize: row.paperSize,
        };
    },

    async create(body: Static<typeof createPaperPlanBodySchema>) {
        // Validate project plan
        const plan = await db.query.projectPlans.findFirst({
            where: and(
                eq(projectPlans.id, body.planId),
                isNull(projectPlans.deletedAt),
            ),
        });
        if (!plan) throw httpError.notFound("Project plan not found");

        // Validate paper size
        const size = await db.query.paperSizes.findFirst({
            where: and(
                eq(paperSizes.id, body.paperSizeId),
                isNull(paperSizes.deletedAt),
            ),
        });
        if (!size) throw httpError.notFound("Paper size not found");

        // Check unique constraint manually to return a nice error
        const existing = await db.query.paperPlans.findFirst({
            where: and(
                eq(paperPlans.planId, body.planId),
                eq(paperPlans.paperSizeId, body.paperSizeId),
                isNull(paperPlans.deletedAt),
            ),
        });

        if (existing) {
            throw httpError.conflict("This paper size is already added to the plan");
        }

        const [inserted] = await db
            .insert(paperPlans)
            .values({
                planId: body.planId,
                paperSizeId: body.paperSizeId,
                quantity: body.quantity,
            })
            .returning();

        return mapPaperPlan(inserted!);
    },

    async update(id: string, body: Static<typeof updatePaperPlanBodySchema>) {
        await getActivePaperPlanOrThrow(id);

        const patch: Partial<typeof paperPlans.$inferInsert> = {
            updatedAt: new Date(),
        };

        if (body.quantity !== undefined) patch.quantity = body.quantity;

        const [updated] = await db
            .update(paperPlans)
            .set(patch)
            .where(and(
                eq(paperPlans.id, id),
                isNull(paperPlans.deletedAt),
            ))
            .returning();

        return mapPaperPlan(updated!);
    },

    async delete(id: string) {
        await getActivePaperPlanOrThrow(id);

        await db
            .update(paperPlans)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(eq(paperPlans.id, id));

        return { id, deleted: true as const };
    },
};
