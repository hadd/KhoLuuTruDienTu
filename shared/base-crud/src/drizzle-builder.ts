import { and, desc, eq, gt, gte, ilike, inArray, lt, lte, notInArray, or, sql, type SQL } from "drizzle-orm";
import type { FilterCondition, FilterNode, SortItem } from "./query.ts";

export type QueryContext = {
    table: any;
    relationTables?: Record<string, any>;
    relationForeignKeys?: Record<string, any>;
    searchable?: string[];
    arrayFields?: Set<string>;
    relationSearchable?: Record<string, string[]>;
};

export const DrizzleBuilder = {
    buildWhere(ctx: QueryContext, filter?: FilterNode, search?: string, extraFilters: SQL[] = []) {
        const conds: SQL[] = [...extraFilters];

        if (search && search.trim()) {
            const likes: SQL[] = [];
            
            if (ctx.searchable?.length) {
                const mainTableLikes = ctx.searchable
                    .map((f) => {
                        const col = (ctx.table as any)[f];
                        if (!col) return null;
                        
                        const isArray = ctx.arrayFields?.has(f);
                        
                        if (isArray) {
                            return ilike(sql`array_to_string(${col}, ' ')`, `%${search}%`);
                        } else {
                            return ilike(col, `%${search}%`);
                        }
                    })
                    .filter((cond): cond is SQL => cond !== null);
                
                likes.push(...mainTableLikes);
            }
            
            if (ctx.relationSearchable && ctx.relationTables) {
                for (const [relationName, fields] of Object.entries(ctx.relationSearchable)) {
                    const relationTable = ctx.relationTables[relationName];
                    if (!relationTable || !Array.isArray(fields)) continue;
                    
                    for (const field of fields) {
                        const col = relationTable[field];
                        if (col) {
                            likes.push(ilike(col, `%${search}%`));
                        }
                    }
                }
            }
            
            if (likes.length === 1) {
                conds.push(likes[0]);
            } else if (likes.length > 1) {
                conds.push(or(...likes)!);
            }
        }
        if (filter) {
            const filterSql = this.applyFilter(ctx, filter);
            if (filterSql) conds.push(filterSql);
        }
        return conds;
    },

    applyFilter(ctx: QueryContext, node: FilterNode): SQL | undefined {
        if ("$and" in (node as any) || "$or" in (node as any)) {
            const group = node as { $and?: FilterNode[]; $or?: FilterNode[] };
            const parts = (group.$and ?? group.$or ?? []).map((n) => this.applyFilter(ctx, n)).filter((p): p is SQL => p !== undefined);
            if (parts.length === 0) return undefined;
            return group.$and ? and(...parts)! : or(...parts)!;
        }
        const c = node as FilterCondition;

        // Check if this is a relation field (e.g., "student.createdAt" or deep path like "books.bookDetails.isbn")
        let col: any;
        const condition = c as FilterCondition & { relationPath?: string[] };
        if (condition.relationPath && condition.relationPath.length > 2) {
            // Deep relation path (e.g., "books.bookDetails.isbn")
            col = this.resolveDeepPath(ctx, condition.relationPath);
        } else if (c.relation && c.relationField && ctx.relationTables?.[c.relation]) {
            // Single-level relation (e.g., "student.createdAt")
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
    },

    resolveDeepPath(ctx: QueryContext, path: string[]): any {
        if (path.length < 2) return undefined;
        
        const finalField = path[path.length - 1];
        const lastRelation = path[path.length - 2];
        const lastTable = ctx.relationTables?.[lastRelation];
        
        if (lastTable && lastTable[finalField]) {
            return lastTable[finalField];
        }
        
        return undefined;
    },

    buildOrderBy(ctx: QueryContext, sort: SortItem[] | undefined, defaultCreatedAt?: unknown) {
        if (!sort || sort.length === 0) return defaultCreatedAt ? [desc(defaultCreatedAt as any)] : [];
        const cols = [] as any[];
        for (const s of sort) {
            // Check if this is a relation field (e.g., "student.name" or deep path like "books.bookDetails.pageCount")
            let col: any;
            const sortItem = s as SortItem & { relationPath?: string[] };
            if (sortItem.relationPath && sortItem.relationPath.length > 2) {
                // Deep relation path (e.g., "books.bookDetails.pageCount")
                col = this.resolveDeepPath(ctx, sortItem.relationPath);
            } else if (s.relation && s.relationField && ctx.relationTables?.[s.relation]) {
                // Single-level relation (e.g., "student.name")
                col = ctx.relationTables[s.relation][s.relationField];
            } else {
                col = (ctx.table as any)[s.field];
            }

            if (!col) continue;
            cols.push(s.direction === "desc" ? desc(col) : col);
        }
        return cols.length ? cols : (defaultCreatedAt ? [desc(defaultCreatedAt as any)] : []);
    },

    // Check if any filter node requires joins
    needsJoins(node?: FilterNode): boolean {
        if (!node) return false;
        if ("$and" in (node as any) || "$or" in (node as any)) {
            const group = node as { $and?: FilterNode[]; $or?: FilterNode[] };
            const children = [...(group.$and ?? []), ...(group.$or ?? [])];
            return children.some((n) => this.needsJoins(n));
        }
        const c = node as FilterCondition & { relationPath?: string[] };
        return !!(c.relation && c.relationField) || !!(c.relationPath && c.relationPath.length > 1);
    },

    // Check if any sort requires joins
    sortNeedsJoins(sort?: SortItem[]): boolean {
        if (!sort) return false;
        return sort.some((s) => {
            const sortItem = s as SortItem & { relationPath?: string[] };
            return !!(s.relation && s.relationField) || !!(sortItem.relationPath && sortItem.relationPath.length > 1);
        });
    },

    // Check if relation search requires joins
    searchNeedsJoins(ctx: QueryContext, search?: string): boolean {
        if (!search || !search.trim()) return false;
        if (!ctx.relationSearchable || !ctx.relationTables) return false;
        return Object.keys(ctx.relationSearchable).some((relationName) => {
            return !!ctx.relationTables?.[relationName];
        });
    },

    getRelationNamesFromFilter(node: FilterNode | undefined, relationTables: Record<string, any> | undefined): Set<string> {
        const out = new Set<string>();
        if (!node || !relationTables || Object.keys(relationTables).length === 0) return out;
        const recurse = (n: FilterNode) => {
            if ("$and" in (n as any) || "$or" in (n as any)) {
                const group = n as { $and?: FilterNode[]; $or?: FilterNode[] };
                for (const child of group.$and ?? group.$or ?? []) {
                    recurse(child);
                }
                return;
            }
            const c = n as FilterCondition & { relationPath?: string[] };
            if (c.relation && relationTables[c.relation]) {
                out.add(c.relation);
            }
            if (c.relationPath && c.relationPath.length > 1) {
                const pathSegments = c.relationPath.slice(0, -1);
                for (const name of pathSegments) {
                    if (relationTables[name]) out.add(name);
                }
            }
        };
        recurse(node);
        return out;
    },

    getRelationNamesFromSort(sort: SortItem[] | undefined, ctx: QueryContext): Set<string> {
        const out = new Set<string>();
        const relationTables = ctx.relationTables;
        if (!sort?.length || !relationTables || Object.keys(relationTables).length === 0) return out;
        for (const s of sort) {
            const sortItem = s as SortItem & { relationPath?: string[] };
            if (s.relation && relationTables[s.relation]) {
                out.add(s.relation);
            }
            if (sortItem.relationPath && sortItem.relationPath.length > 1) {
                const pathSegments = sortItem.relationPath.slice(0, -1);
                for (const name of pathSegments) {
                    if (relationTables[name]) out.add(name);
                }
            }
        }
        return out;
    },
};


