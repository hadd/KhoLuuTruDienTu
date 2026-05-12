import { and, desc, eq, gt, gte, ilike, inArray, lt, lte, notInArray, or, sql, type SQL } from "drizzle-orm";
import type { FilterCondition, FilterNode, ListQuery, SortItem } from "../parse/types.ts";
import type { DrizzleListQuery, QueryContext } from "./types.ts";

function applyFilter(ctx: QueryContext, node: FilterNode): SQL | undefined {
    if ("$and" in (node as object) || "$or" in (node as object)) {
        const group = node as { $and?: FilterNode[]; $or?: FilterNode[] };
        const parts = (group.$and ?? group.$or ?? [])
            .map((n) => applyFilter(ctx, n))
            .filter((p): p is SQL => p !== undefined);
        if (parts.length === 0) return undefined;
        return group.$and ? and(...parts)! : or(...parts)!;
    }
    const c = node as FilterCondition & { relationPath?: string[] };
    let col: any;
    if (c.relationPath && c.relationPath.length > 2) {
        const finalField = c.relationPath[c.relationPath.length - 1];
        const lastRelation = c.relationPath[c.relationPath.length - 2];
        col = ctx.relationTables?.[lastRelation]?.[finalField];
    } else if (c.relation && c.relationField && ctx.relationTables?.[c.relation]) {
        col = ctx.relationTables[c.relation][c.relationField];
    } else {
        col = (ctx.table as any)[c.field];
    }
    if (!col) return sql`1=1`;
    switch (c.op) {
        case "$eq":
            return eq(col, c.value as any);
        case "$in":
            return Array.isArray(c.value) && c.value.length > 0 ? inArray(col, c.value as any[]) : sql`1=1`;
        case "$nin":
            return Array.isArray(c.value) && c.value.length > 0 ? notInArray(col, c.value as any[]) : sql`1=1`;
        case "$gte":
            return gte(col, c.value as any);
        case "$lte":
            return lte(col, c.value as any);
        case "$gt":
            return gt(col, c.value as any);
        case "$lt":
            return lt(col, c.value as any);
        default:
            return sql`1=1`;
    }
}

function needsJoinsFilter(node?: FilterNode): boolean {
    if (!node) return false;
    if ("$and" in (node as object) || "$or" in (node as object)) {
        const group = node as { $and?: FilterNode[]; $or?: FilterNode[] };
        return [...(group.$and ?? []), ...(group.$or ?? [])].some(needsJoinsFilter);
    }
    const c = node as FilterCondition & { relationPath?: string[] };
    return !!(c.relation && c.relationField) || !!(c.relationPath && c.relationPath.length > 1);
}

function sortNeedsJoins(sort?: SortItem[]): boolean {
    if (!sort) return false;
    return sort.some((s) => {
        const si = s as SortItem & { relationPath?: string[] };
        return !!(s.relation && s.relationField) || !!(si.relationPath && si.relationPath.length > 1);
    });
}

function searchNeedsJoins(ctx: QueryContext, search?: string): boolean {
    if (!search?.trim()) return false;
    if (!ctx.relationSearchable || !ctx.relationTables) return false;
    return Object.keys(ctx.relationSearchable).some((name) => !!ctx.relationTables?.[name]);
}

function buildOrderBy(ctx: QueryContext, sort: SortItem[] | undefined, defaultCreatedAt?: unknown): SQL[] {
    if (!sort || sort.length === 0) return defaultCreatedAt ? [desc(defaultCreatedAt as any)] : [];
    const cols: any[] = [];
    for (const s of sort) {
        const si = s as SortItem & { relationPath?: string[] };
        let col: any;
        if (si.relationPath && si.relationPath.length > 2) {
            const finalField = si.relationPath[si.relationPath.length - 1];
            const lastRelation = si.relationPath[si.relationPath.length - 2];
            col = ctx.relationTables?.[lastRelation]?.[finalField];
        } else if (s.relation && s.relationField && ctx.relationTables?.[s.relation]) {
            col = ctx.relationTables[s.relation][s.relationField];
        } else {
            col = (ctx.table as any)[s.field];
        }
        if (!col) continue;
        cols.push(s.direction === "desc" ? desc(col) : col);
    }
    return cols.length ? cols : defaultCreatedAt ? [desc(defaultCreatedAt as any)] : [];
}

export function buildDrizzleQuery(
    parsed: ListQuery,
    context: QueryContext,
    extraFilters: SQL[] = [],
    directWhere?: SQL | SQL[],
): DrizzleListQuery {
    const conds: SQL[] = [...extraFilters];

    if (parsed.search?.trim()) {
        const likes: SQL[] = [];
        if (context.searchable?.length) {
            for (const f of context.searchable) {
                const col = (context.table as any)[f];
                if (!col) continue;
                const isArray = context.arrayFields?.has(f);
                likes.push(isArray ? ilike(sql`array_to_string(${col}, ' ')`, `%${parsed.search}%`) : ilike(col, `%${parsed.search}%`));
            }
        }
        if (context.relationSearchable && context.relationTables) {
            for (const [relationName, fields] of Object.entries(context.relationSearchable)) {
                const relTable = context.relationTables[relationName];
                if (!relTable || !Array.isArray(fields)) continue;
                for (const field of fields) {
                    const col = relTable[field];
                    if (col) likes.push(ilike(col, `%${parsed.search}%`));
                }
            }
        }
        if (likes.length === 1) conds.push(likes[0]);
        else if (likes.length > 1) conds.push(or(...likes)!);
    }

    if (parsed.filter) {
        const filterSql = applyFilter(context, parsed.filter);
        if (filterSql) conds.push(filterSql);
    }

    const directArr = directWhere ? (Array.isArray(directWhere) ? directWhere : [directWhere]) : [];
    const allConds = conds.length || directArr.length ? and(...conds, ...directArr)! : undefined;

    const orderBy = buildOrderBy(context, parsed.sort, (context.table as any).createdAt);
    const limit = parsed.limit ?? 50;
    const page = parsed.page ?? 1;
    const offset = (page - 1) * limit;

    const relationTables = context.relationTables ?? {};
    const requireJoins =
        Object.keys(relationTables).length > 0 &&
        (needsJoinsFilter(parsed.filter) || sortNeedsJoins(parsed.sort) || searchNeedsJoins(context, parsed.search))
            ? Object.keys(relationTables)
            : [];

    return {
        where: allConds,
        orderBy,
        limit,
        offset,
        requireJoins,
        parsed,
        metadata: {
            hasFilters: !!parsed.filter,
            hasSearch: !!parsed.search?.trim(),
            hasSort: !!(parsed.sort && parsed.sort.length > 0),
            joinDependencies: new Map(),
        },
    };
}
