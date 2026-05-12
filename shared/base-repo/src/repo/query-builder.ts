import type { SQL } from "drizzle-orm";
import { parseQueryString } from "../parse/query-parser.ts";
import type { FilterNode, ListQuery, SortItem } from "../parse/types.ts";

function normalizeToFilterNode(filter: FilterNode | Record<string, unknown>): FilterNode | undefined {
    if (!filter || typeof filter !== "object") return undefined;
    if ("field" in (filter as object) && "op" in (filter as object)) return filter as FilterNode;
    const o = filter as Record<string, unknown>;
    const nodes: FilterNode[] = [];
    for (const [field, val] of Object.entries(o)) {
        if (!val || typeof val !== "object") continue;
        const ops = val as Record<string, unknown>;
        for (const [op, raw] of Object.entries(ops)) {
            if (!op.startsWith("$")) continue;
            if (op !== "$eq" && op !== "$in" && op !== "$nin" && op !== "$gte" && op !== "$lte" && op !== "$gt" && op !== "$lt") continue;
            nodes.push({ field, op: op as FilterNode extends { op: infer O } ? O : never, value: raw });
        }
    }
    if (nodes.length === 0) return undefined;
    if (nodes.length === 1) return nodes[0];
    return { $and: nodes };
}

function parseSortString(s: string): SortItem[] {
    return s.split(",").map((p) => {
        const [field, dir] = p.trim().split(":");
        return { field: field!.trim(), direction: dir?.toLowerCase() === "desc" ? "desc" as const : "asc" as const };
    }).filter((x) => x.field);
}

export class ListQueryBuilder {
    private _query: ListQuery;
    private _directWhere: SQL[] = [];

    constructor(initialParams?: Record<string, unknown>, private _defaultWith?: Record<string, unknown>) {
        this._query = initialParams ? parseQueryString(initialParams) : {};
    }

    where(condition: SQL | SQL[]): this {
        if (Array.isArray(condition)) this._directWhere.push(...condition);
        else this._directWhere.push(condition);
        return this;
    }

    whereFilter(filter: FilterNode | Record<string, unknown>): this {
        const node = normalizeToFilterNode(filter);
        if (node) this._query = { ...this._query, filter: this._query.filter ? { $and: [this._query.filter, node] } : node };
        return this;
    }

    select(fields: string[]): this {
        this._query = { ...this._query, fields };
        return this;
    }

    selectMerge(fields: string[] | Record<string, unknown>): this {
        const withMerge = typeof fields === "object" && !Array.isArray(fields)
            ? { ...this._defaultWith, ...fields }
            : this._defaultWith;
        this._query = { ...this._query, include: Array.isArray(fields) ? fields : undefined };
        (this as any)._mergedWith = withMerge;
        return this;
    }

    sort(sort: SortItem[] | string): this {
        this._query = { ...this._query, sort: typeof sort === "string" ? parseSortString(sort) : sort };
        return this;
    }

    search(query: string): this {
        this._query = { ...this._query, search: query };
        return this;
    }

    page(page: number): this {
        this._query = { ...this._query, page };
        return this;
    }

    limit(limit: number): this {
        this._query = { ...this._query, limit };
        return this;
    }

    paging(enabled: boolean): this {
        this._query = { ...this._query, paging: enabled };
        return this;
    }

    include(relations: string[] | Record<string, unknown>): this {
        this._query = {
            ...this._query,
            include: Array.isArray(relations) ? relations : relations ? Object.keys(relations) : undefined,
        };
        return this;
    }

    build(): ListQuery {
        return { ...this._query };
    }

    getDirectWhere(): SQL[] {
        return [...this._directWhere];
    }

    getMergedWith(): Record<string, unknown> | undefined {
        return (this as any)._mergedWith;
    }
}
