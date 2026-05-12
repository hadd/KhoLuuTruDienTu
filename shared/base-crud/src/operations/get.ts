import { and, eq, isNull } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { httpError } from "@shared/common-lib";
import type { DatabaseQuery } from "../types.ts";
// Nhớ import hàm mergeRelationOptions vừa tạo
import { validateId, sanitizeWithObject, mergeRelationOptions } from "../utils.ts"; 

export type GetOptions<ID = string | number> = {
    with?: any;
    internalFilterQuery?: () => SQL | undefined;
};

export type GetOperationContext<ID = string | number> = {
    db: unknown;
    table: any;
    restrictServiceQuery?: () => SQL;
    resolvedQueryKey?: string;
    relationalQueryApi: DatabaseQuery<ID>;
    defaultWith?: Record<string, unknown>;
    mapRecord?: (rows: unknown[]) => Promise<unknown[]> | unknown[];
};

/**
 * Execute a get operation to retrieve a single record by ID
 */
export async function executeGetOperation<Entity, ID extends string | number = string | number>(
    context: GetOperationContext<ID>,
    id: ID,
    options?: GetOptions<ID>,
): Promise<Entity> {
    const {
        db,
        table,
        restrictServiceQuery,
        resolvedQueryKey,
        defaultWith,
        mapRecord,
    } = context;

    // --- 1. Validation ---
    try {
        validateId(id);
    } catch (error) {
        throw httpError.badRequest((error as Error).message);
    }

    // --- 2. Build Query Conditions ---
    const conditions = [eq((table as any).id, id)];
    
    if (restrictServiceQuery) {
        conditions.push(restrictServiceQuery());
    }
    
    if (options?.internalFilterQuery) {
        const filterSql = options.internalFilterQuery();
        if (filterSql) {
            conditions.push(filterSql);
        }
    }

    if ((table as any).deletedAt) {
        conditions.push(isNull((table as any).deletedAt));
    }

    // --- 3. Main Query Execution ---
    const rows: Entity[] = await (db as any)
        .select()
        .from(table as any)
        .where(and(...conditions))
        .limit(1);

    if (!rows[0]) {
        throw httpError.notFound(`Request record id=${id} not found`);
    }

    // --- 4. Relation Handling (Refactored) ---
    // Chỉ thực hiện logic relation khi có queryKey và user không cấm (with !== false)
    if (resolvedQueryKey && options?.with !== false) {
        // Sử dụng helper function đã tách để xử lý logic merge phức tạp
        const effectiveWith = mergeRelationOptions(defaultWith, options?.with);
        
        // Sanitize object trước khi query
        const sanitizedWith = sanitizeWithObject(effectiveWith);

        // Chỉ query nếu có relation cần lấy
        if (Object.keys(sanitizedWith).length > 0) {
            const relRows = await (db as any).query?.[resolvedQueryKey as string]?.findMany?.({
                where: (row: { id: ID }, { inArray }: any) => inArray(row.id, [id] as ID[]),
                with: sanitizedWith,
            });
            
            if (relRows && relRows.length > 0) {
                const rel = relRows[0];
                const mappedRel = mapRecord ? await Promise.resolve(mapRecord([rel as unknown])) : undefined;
                return (mappedRel?.[0] as Entity) ?? rel;
            }
        }
    }
    
    // --- 5. Final Mapping & Return ---
    const mapped = mapRecord ? await Promise.resolve(mapRecord([rows[0] as unknown])) : undefined;
    return (mapped?.[0] as Entity) ?? rows[0];
}