export type ComparisonOperator = "$eq" | "$in" | "$nin" | "$gte" | "$lte" | "$gt" | "$lt";

export type LogicalOperator = "$and" | "$or";

export interface FilterCondition {
    field: string;
    op: ComparisonOperator;
    value: unknown;
    // For nested fields like "student.createdAt" or deep paths like "books.bookDetails.isbn"
    relation?: string; // e.g., "student" or "books" for deep paths
    relationField?: string; // e.g., "createdAt" or "bookDetails.isbn" for deep paths
    // For deep relation paths (e.g., "books.bookDetails.isbn")
    relationPath?: string[]; // e.g., ["books", "bookDetails", "isbn"]
}

export type FilterNode = FilterCondition | { $and?: FilterNode[]; $or?: FilterNode[] };

export interface SortItem {
    field: string;
    direction: "asc" | "desc";
    // For nested fields like "student.name" or deep paths like "books.bookDetails.pageCount"
    relation?: string;
    relationField?: string;
    // For deep relation paths (e.g., "books.bookDetails.pageCount")
    relationPath?: string[]; // e.g., ["books", "bookDetails", "pageCount"]
}

export interface ListQuery {
    filter?: FilterNode;
    sort?: SortItem[];
    search?: string;
    limit?: number;
    page?: number;
    paging?: boolean;
    debug?: boolean;
}

function toArray<T>(v: T | T[] | undefined): T[] {
    if (v === undefined) return [];
    return Array.isArray(v) ? v : [v];
}

// Elysia's query is a plain object. Also support URLSearchParams and string.
export function parseQueryString(input: URLSearchParams | string | Record<string, unknown>): ListQuery {
    let directFilter: FilterNode | undefined;
    if (typeof input === "object" && !(input instanceof URLSearchParams) && input.filter && typeof input.filter === "object" && !Array.isArray(input.filter)) {
        directFilter = normalizeFilterObject(input.filter);
    }
    
    const params: URLSearchParams = input instanceof URLSearchParams
        ? input
        : typeof input === "string"
        ? new URLSearchParams(input.startsWith("?") ? input.slice(1) : input)
        : new URLSearchParams(Object.entries(flatten(input)).map(([k, v]) => [k, String(v)]));

    // Normalize search: treat '+' as spaces to support x-www-form-urlencoded style encoding in query strings
    const rawSearch = params.get("search");
    const search = rawSearch !== null ? rawSearch.replace(/\+/g, " ") : undefined;
    const sort = parseSort(params.get("sort"));
    
    // Prefer directFilter when available (from plain object input)
    // Otherwise try to parse filter from bracket notation
    let filter: FilterNode | undefined;
    if (directFilter) {
        filter = directFilter;
    } else {
        filter = parseFilter(params);
        
        // If no bracket notation found, try JSON in filter parameter
        if (!filter) {
            const filterJson = params.get("filter");
            if (filterJson) {
                try {
                    const parsed = JSON.parse(filterJson);
                    filter = normalizeFilterObject(parsed);
                } catch {
                    // Ignore invalid JSON
                }
            }
        }
    }

    const limitRaw = params.get("limit");
    const pageRaw = params.get("page");
    const pagingRaw = params.get("paging");
    const paging = pagingRaw === "false" ? false : (pagingRaw === "true" ? true : undefined);
    
    let limit: number;
    if (paging === false) {
        const maxLimit = 50;
        const defaultLimit = 10;
        limit = limitRaw ? Math.min(Math.max(Number(limitRaw), 1), maxLimit) : defaultLimit;
        if (Number.isNaN(limit)) limit = defaultLimit;
    } else {
        const maxLimit = 400;
        const defaultLimit = 50;
        limit = limitRaw ? Math.min(Math.max(Number(limitRaw), 1), maxLimit) : defaultLimit;
        if (Number.isNaN(limit)) limit = defaultLimit;
    }
    
    let page = pageRaw ? Math.max(Number(pageRaw), 1) : 1;
    if (Number.isNaN(page)) page = 1;
    const debug  = params.get("debug") === "true";
    return { search, sort, filter, limit, page, paging, debug};
}

function parseSort(raw: string | null): SortItem[] | undefined {
    if (!raw) return undefined;
    const items = raw.split(",").map((p) => p.trim()).filter(Boolean);
    const out: SortItem[] = [];
    for (const item of items) {
        const [field, dirRaw] = item.split(":");
        if (!field) continue;
        const direction: "asc" | "desc" = dirRaw?.toLowerCase() === "desc" ? "desc" : "asc";
        
        // Check if field is nested (e.g., "student.createdAt" or deep path like "books.bookDetails.pageCount")
        if (field.includes(".")) {
            const pathParts = field.split(".");
            if (pathParts.length === 2) {
                // Single-level relation (e.g., "student.createdAt")
                const [relation, relationField] = pathParts;
                out.push({ field, direction, relation, relationField });
            } else {
                // Deep relation path (e.g., "books.bookDetails.pageCount")
                const relationPath = pathParts;
                const relation = relationPath[0];
                const relationField = relationPath.slice(1).join(".");
                out.push({ field, direction, relation, relationField, relationPath });
            }
        } else {
            out.push({ field, direction });
        }
    }
    return out.length ? out : undefined;
}

// Expect bracket syntax: filter[field][$op]=value, and nested groups via filter[$and][0][field][$op]
function parseFilter(params: URLSearchParams): FilterNode | undefined {
    // Build a nested object from keys starting with filter[
    const filterEntries = Array.from(params.entries()).filter(([k]) => k.startsWith("filter["));
    if (filterEntries.length === 0) return undefined;
    const root: Record<string, unknown> = {};
    for (const [key, value] of filterEntries) {
        const path = parseBracketPath(key); // e.g., ["filter", "name", "$eq"]
        if (path[0] !== "filter") continue;
        setDeep(root, path.slice(1), coerceValue(value));
    }
    return normalizeFilterObject(root as Record<string, unknown>);
}

function parseBracketPath(key: string): string[] {
    const parts: string[] = [];
    let current = "";
    for (let i = 0; i < key.length; i++) {
        const ch = key[i];
        if (ch === "[") {
            if (current) parts.push(current);
            current = "";
            continue;
        }
        if (ch === "]") {
            parts.push(current);
            current = "";
            continue;
        }
        current += ch;
    }
    if (current) parts.push(current);
    return parts;
}

function setDeep(obj: Record<string, unknown>, path: string[], value: unknown) {
    let cur: any = obj;
    const lastIdx = path.length - 1;
    for (let i = 0; i < lastIdx; i++) {
        const seg = path[i];
        const isNumericIndex = /^[0-9]+$/.test(seg);
        const nextSeg = path[i + 1];
        const nextIsNumeric = nextSeg && /^[0-9]+$/.test(nextSeg);
        
        if (isNumericIndex) {
            const arrKey = path[i - 1];
            if (arrKey === undefined) {
                throw new Error(`Invalid path: numeric index at position 0: ${path.join(".")}`);
            }
            if (!Array.isArray(cur[arrKey])) {
                cur[arrKey] = [];
            }
            const idx = parseInt(seg, 10);
            const arrRef = cur[arrKey] as unknown[];
            while (arrRef.length <= idx) {
                arrRef.push({});
            }
            if (!arrRef[idx] || typeof arrRef[idx] !== "object" || arrRef[idx] === null) {
                arrRef[idx] = {};
            }
            cur = arrRef[idx];
        } else if (nextIsNumeric) {
            if (!(seg in cur) || !Array.isArray(cur[seg])) {
                cur[seg] = [];
            }
        } else {
            if (nextIsNumeric) {
                if (!(seg in cur) || !Array.isArray(cur[seg])) {
                    cur[seg] = [];
                }
            } else {
                if (!(seg in cur) || typeof cur[seg] !== "object" || cur[seg] === null || Array.isArray(cur[seg])) {
                    cur[seg] = {};
                }
                cur = cur[seg];
            }
        }
    }
    const lastSeg = path[lastIdx];
    // Support array-style brackets: e.g., key[]=value → lastSeg === ""
    if (lastSeg === "" || /^[0-9]+$/.test(lastSeg)) {
        const arrKey = path[lastIdx - 1];
        if (arrKey === undefined) {
            throw new Error(`Invalid path: numeric index at last position without previous key: ${path.join(".")}`);
        }
        if (!Array.isArray(cur[arrKey])) cur[arrKey] = [];
        (cur[arrKey] as unknown[]).push(value);
        return;
    }
    // If same path assigned multiple times, aggregate into array
    if (lastSeg in cur) {
        const existing = cur[lastSeg];
        if (Array.isArray(existing)) existing.push(value);
        else cur[lastSeg] = [existing, value];
        return;
    }
    cur[lastSeg] = value;
}

function coerceValue(v: string): unknown {
    if (v === "true") return true;
    if (v === "false") return false;
    if (!Number.isNaN(Number(v)) && v.trim() !== "") return Number(v);
    try {
        // support JSON arrays for $in/$nin
        const parsed = JSON.parse(v);
        return parsed;
    } catch {
        // If it looks like an array but failed to parse, try to extract values
        if (v.startsWith('[') && v.endsWith(']')) {
            const inner = v.slice(1, -1);
            const items = inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
            return items;
        }
        return v;
    }
}

function normalizeFilterObject(obj: unknown): FilterNode | undefined {
    const o = obj as Record<string, unknown>;
    if (!o || typeof o !== "object") return undefined;
    // Logical groups
    if ("$and" in o || "$or" in o) {
        const andChildren = "$and" in o ? toArray((o as { $and?: unknown }).$and) : [];
        const orChildren = "$or" in o ? toArray((o as { $or?: unknown }).$or) : [];
        const group: { $and?: FilterNode[]; $or?: FilterNode[] } = {};
        const andNodes = andChildren.map(normalizeFilterObject).filter(Boolean) as FilterNode[];
        const orNodes = orChildren.map(normalizeFilterObject).filter(Boolean) as FilterNode[];
        if (andNodes.length) group.$and = andNodes;
        if (orNodes.length) group.$or = orNodes;
        return group;
    }
    // Field-based with ops
    const nodes: FilterNode[] = [];
    for (const [field, ops] of Object.entries(o)) {
        if (!ops || typeof ops !== "object") continue;
        for (const [op, raw] of Object.entries(ops as Record<string, unknown>)) {
            if (!isComparisonOp(op)) continue;
            let value: unknown = raw;
            if (value && typeof value === "object" && (op in (value as Record<string, unknown>))) {
                value = (value as Record<string, unknown>)[op];
            }
            
            if ((op === "$in" || op === "$nin") && typeof value === "string") {
                value = value.split(",").map(s => s.trim()).filter(Boolean);
            }
            
            // Check if field is nested (e.g., "student.createdAt" or deep path like "books.bookDetails.isbn")
            if (field.includes(".")) {
                const pathParts = field.split(".");
                if (pathParts.length === 2) {
                    // Single-level relation (e.g., "student.createdAt")
                    const [relation, relationField] = pathParts;
                    nodes.push({ field, op, value, relation, relationField } as FilterCondition);
                } else {
                    // Deep relation path (e.g., "books.bookDetails.isbn")
                    const relationPath = pathParts;
                    const relation = relationPath[0];
                    const relationField = relationPath.slice(1).join(".");
                    nodes.push({ field, op, value, relation, relationField, relationPath } as FilterCondition);
                }
            } else {
                nodes.push({ field, op, value } as FilterCondition);
            }
        }
    }
    if (nodes.length === 0) return undefined;
    if (nodes.length === 1) return nodes[0];
    return { $and: nodes };
}

function isComparisonOp(op: string): op is ComparisonOperator {
    return op === "$eq" || op === "$in" || op === "$nin" || op === "$gte" || op === "$lte" || op === "$gt" || op === "$lt";
}

function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}[${k}]` : k;
        if (Array.isArray(v)) {
            v.forEach((item, idx) => {
                if (item && typeof item === "object") {
                    Object.assign(out, flatten(item as Record<string, unknown>, `${key}[${idx}]`));
                } else {
                    out[`${key}[${idx}]`] = item;
                }
            });
        } else if (v && typeof v === "object") {
            Object.assign(out, flatten(v as Record<string, unknown>, key));
        } else {
            out[key] = v as unknown;
        }
    }
    return out;
}


