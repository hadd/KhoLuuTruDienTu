import { and, eq, isNull } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import { validateId } from "../utils.ts";

export type DeleteOptions = {
    internalFilterQuery?: () => SQL;
};

export type DeleteOperationContext<ID = string | number> = {
    db: unknown;
    table: any;
    mapRecord?: (rows: unknown[]) => Promise<unknown[]> | unknown[];
};

/**
 * Execute a delete operation (soft delete if deletedAt exists, otherwise hard delete)
 */
export async function executeDeleteOperation<ID extends string | number = string | number>(
    context: DeleteOperationContext<ID>,
    id: ID,
    options?: DeleteOptions,
): Promise<{ id: ID }> {
    const { db, table, mapRecord } = context;

    try {
        validateId(id);
    } catch (error) {
        throw httpError.badRequest((error as Error).message);
    }

    const conditions = [eq((table as any).id, id)];
    if ((table as any).deletedAt) {
        conditions.push(isNull((table as any).deletedAt));
    }
    if (options?.internalFilterQuery) {
        conditions.push(options.internalFilterQuery());
    }

    if ((table as any).deletedAt) {
        const [row] = await (db as any)
            .update(table as any)
            .set({
                deletedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(and(...conditions))
            .returning({ id: (table as any).id });

        if (!row) {
            throw httpError.notFound("Not Found");
        }
    } else {
        const [row] = await (db as any)
            .delete(table as any)
            .where(and(...conditions))
            .returning({ id: (table as any).id });

        if (!row) {
            throw httpError.notFound("Not Found");
        }
    }

    const mapped = mapRecord ? await Promise.resolve(mapRecord([{ id } as unknown])) : undefined;
    const out = (mapped?.[0] as { id: ID }) ?? { id };
    return out;
}
