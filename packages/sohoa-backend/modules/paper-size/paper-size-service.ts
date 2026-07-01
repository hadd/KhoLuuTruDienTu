import { httpError } from "@shared/common-lib";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Static } from "elysia";
import { db } from "../../db/db-conn.ts";
import { paperSizes } from "../../db/schemas/paper-size.ts";
import {
    createPaperSizeBodySchema,
    updatePaperSizeBodySchema,
} from "./types.ts";

function mapPaperSize(row: typeof paperSizes.$inferSelect) {
    return {
        id: row.id,
        name: row.name,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

async function getActivePaperSizeOrThrow(id: string) {
    const row = await db.query.paperSizes.findFirst({
        where: and(
            eq(paperSizes.id, id),
            isNull(paperSizes.deletedAt),
        ),
    });

    if (!row) {
        throw httpError.notFound("Paper size not found");
    }

    return row;
}

export const PaperSizeService = {
    async list(input?: {
        limit?: number;
        offset?: number;
        ids?: string[];
    }) {
        const limit = Math.min(input?.limit ?? 50, 200);
        const offset = input?.offset ?? 0;

        const conditions = [isNull(paperSizes.deletedAt)];
        if (input?.ids?.length) {
            conditions.push(inArray(paperSizes.id, input.ids));
        } else if (input?.ids && input.ids.length === 0) {
            conditions.push(sql`false`);
        }

        const rows = await db.query.paperSizes.findMany({
            where: and(...conditions),
            orderBy: [desc(paperSizes.updatedAt)],
            limit,
            offset,
        });

        return {
            items: rows.map(mapPaperSize),
            limit,
            offset,
        };
    },

    async get(id: string) {
        return mapPaperSize(await getActivePaperSizeOrThrow(id));
    },

    async create(body: Static<typeof createPaperSizeBodySchema>) {
        const existing = await db.query.paperSizes.findFirst({
            where: and(
                eq(paperSizes.name, body.name),
                isNull(paperSizes.deletedAt),
            ),
        });

        if (existing) {
            throw httpError.conflict("Paper size with this name already exists");
        }

        const [inserted] = await db
            .insert(paperSizes)
            .values({
                name: body.name,
            })
            .returning();

        return mapPaperSize(inserted!);
    },

    async update(id: string, body: Static<typeof updatePaperSizeBodySchema>) {
        await getActivePaperSizeOrThrow(id);

        if (body.name) {
            const existing = await db.query.paperSizes.findFirst({
                where: and(
                    eq(paperSizes.name, body.name),
                    isNull(paperSizes.deletedAt),
                ),
            });
            if (existing && existing.id !== id) {
                throw httpError.conflict("Paper size with this name already exists");
            }
        }

        const patch: Partial<typeof paperSizes.$inferInsert> = {
            updatedAt: new Date(),
        };

        if (body.name !== undefined) patch.name = body.name;

        const [updated] = await db
            .update(paperSizes)
            .set(patch)
            .where(and(
                eq(paperSizes.id, id),
                isNull(paperSizes.deletedAt),
            ))
            .returning();

        return mapPaperSize(updated!);
    },

    async delete(id: string) {
        await getActivePaperSizeOrThrow(id);

        await db
            .update(paperSizes)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(eq(paperSizes.id, id));

        return { id, deleted: true as const };
    },
};
