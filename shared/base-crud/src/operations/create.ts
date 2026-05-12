
import type { DatabaseQuery, RelationalOperators } from "../types.ts";
import { sanitizeWithObject } from "../utils.ts";

export type CreateOperationContext<ID = string | number> = {
    db: unknown;
    table: any;
    resolvedQueryKey?: string;
    relationalQueryApi: DatabaseQuery<ID>;
    defaultWith?: Record<string, unknown>;
    mapRecord?: (rows: unknown[]) => Promise<unknown[]> | unknown[];
};

/**
 * Execute a create operation to insert a new record
 */
export async function executeCreateOperation<Entity, CreateInput, ID extends string | number = string | number>(
    context: CreateOperationContext<ID>,
    input: CreateInput,
): Promise<Entity> {
    const {
        db,
        table,
        resolvedQueryKey,
        relationalQueryApi,
        defaultWith,
        mapRecord,
    } = context;

    const [row]: Entity[] = await (db as any)
        .insert(table as any)
        .values(input as any)
        .returning();
    
    const queryApi = (relationalQueryApi as any)?.[resolvedQueryKey as string];
    if (resolvedQueryKey && queryApi?.findMany) {
        const effectiveWith = defaultWith ?? {};
        const sanitizedWith = sanitizeWithObject(effectiveWith);
        const relRows = await queryApi.findMany({
            where: (r: { id: ID }, operators: RelationalOperators<ID>) =>
                operators.inArray(r.id, [((row as unknown) as { id: ID }).id]),
            with: sanitizedWith,
        });
        const rel = relRows?.[0] ?? row;
        const mappedRel = mapRecord ? await Promise.resolve(mapRecord([rel as unknown])) : undefined;
        return (mappedRel?.[0] as Entity) ?? rel;
    }
    
    const mapped = mapRecord ? await Promise.resolve(mapRecord([row as unknown])) : undefined;
    return (mapped?.[0] as Entity) ?? row;
}
