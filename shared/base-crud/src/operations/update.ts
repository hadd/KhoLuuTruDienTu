import { and, eq } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import type { DatabaseQuery } from "../types.ts";
import { validateId, sanitizeWithObject } from "../utils.ts";

export type UpdateOptions = {
    internalFilterQuery?: () => SQL;
};

export type UpdateOperationContext<ID = string | number> = {
    db: unknown;
    table: any;
    resolvedQueryKey?: string;
    relationalQueryApi: DatabaseQuery<ID>;
    defaultWith?: Record<string, unknown>;
    mapRecord?: (rows: unknown[]) => Promise<unknown[]> | unknown[];
};

/**
 * Execute an update operation to modify an existing record
 */
export async function executeUpdateOperation<Entity, UpdateInput, ID extends string | number = string | number>(
    context: UpdateOperationContext<ID>,
    id: ID,
    input: UpdateInput,
    options?: UpdateOptions,
): Promise<Entity> {
    const {
        db,
        table,
        resolvedQueryKey,
        defaultWith,
        mapRecord,
    } = context;

    try {
        validateId(id);
    } catch (error) {
        throw httpError.badRequest((error as Error).message);
    }

    const conditions = [eq((table as any).id, id)];
    if (options?.internalFilterQuery) {
        conditions.push(options.internalFilterQuery());
    }

    const [row]: Entity[] = await (db as any)
        .update(table as any)
        .set({ ...(input as any), updatedAt: new Date() })
        .where(and(...conditions))
        .returning();

    if (!row) {
        throw httpError.notFound("Not Found");
    }

    if (resolvedQueryKey) {
        const effectiveWith = defaultWith ?? {};
        const sanitizedWith = sanitizeWithObject(effectiveWith);
        const relRows = await (db as any).query?.[resolvedQueryKey as string]?.findMany?.({
            where: (r: { id: ID }, { inArray }: any) => 
                inArray(r.id, [id] as ID[]),
            with: sanitizedWith,
        });
        
        if (relRows && relRows.length > 0) {
            const rel = relRows[0];
            const mappedRel = mapRecord ? await Promise.resolve(mapRecord([rel as unknown])) : undefined;
            return (mappedRel?.[0] as Entity) ?? rel;
        }
    }
    
    const mapped = mapRecord ? await Promise.resolve(mapRecord([row as unknown])) : undefined;
    return (mapped?.[0] as Entity) ?? row;
}
