import { CRUD_SPEC } from "../spec/crud-api.ts";
import type { FilterCondition, FilterNode, ListQuery, SortItem } from "./types.ts";

function toArray<T>(v: T | T[] | undefined): T[] {
    if (v === undefined) return [];
    return Array.isArray(v) ? v : [v];
}

function isComparisonOp(op: string): op is (typeof CRUD_SPEC.FILTER_OPERATORS)[number] {
    return CRUD_SPEC.FILTER_OPERATORS.includes(op as any);
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
    let cur: Record<string, unknown> = obj;
    const lastIdx = path.length - 1;
    for (let i = 0; i < lastIdx; i++) {
        const seg = path[i];
        const isNumericIndex = /^[0-9]+$/.test(seg);
        const nextSeg = path[i + 1];
        const nextIsNumeric = nextSeg && /^[0-9]+$/.test(nextSeg);

        if (isNumericIndex) {
            const arrKey = path[i - 1];
            if (arrKey === undefined) throw new Error(`Invalid path: ${path.join(".")}`);
            if (!Array.isArray(cur[arrKey])) cur[arrKey] = [];
            const idx = parseInt(seg, 10);
            const arrRef = cur[arrKey] as unknown[];
            while (arrRef.length <= idx) arrRef.push({});
            const el = arrRef[idx];
            if (!el || typeof el !== "object" || Array.isArray(el)) arrRef[idx] = {};
            cur = arrRef[idx] as Record<string, unknown>;
        } else if (nextIsNumeric) {
            if (!(seg in cur) || !Array.isArray(cur[seg])) cur[seg] = [];
        } else {
            if (!(seg in cur) || typeof cur[seg] !== "object" || cur[seg] === null || Array.isArray(cur[seg])) {
                cur[seg] = {};
            }
            cur = cur[seg] as Record<string, unknown>;
        }
    }
    const lastSeg = path[lastIdx];
    if (lastSeg === "" || /^[0-9]+$/.test(lastSeg)) {
        const arrKey = path[lastIdx - 1];
        if (arrKey === undefined) throw new Error(`Invalid path: ${path.join(".")}`);
        if (!Array.isArray(cur[arrKey])) cur[arrKey] = [];
        (cur[arrKey] as unknown[]).push(value);
        return;
    }
    if (lastSeg in cur) {
        const existing = cur[lastSeg];
        if (Array.isArray(existing)) (existing as unknown[]).push(value);
        else cur[lastSeg] = [existing, value];
        return;
    }
    cur[lastSeg] = value;
}

function coerceValue(v: string): unknown {
    if (v === "true") return true;
    if (v === "false") return false;
    if (v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
    try {
        return JSON.parse(v);
    } catch {
        if (v.startsWith("[") && v.endsWith("]")) {
            const inner = v.slice(1, -1);
            return inner.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
        }
        return v;
    }
}

function normalizeFilterObject(obj: unknown): FilterNode | undefined {
    const o = obj as Record<string, unknown>;
    if (!o || typeof o !== "object") return undefined;
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
    const nodes: FilterNode[] = [];
    for (const [field, ops] of Object.entries(o)) {
        if (!ops || typeof ops !== "object") continue;
        for (const [op, raw] of Object.entries(ops as Record<string, unknown>)) {
            if (!isComparisonOp(op)) continue;
            let value: unknown = raw;
            if (value && typeof value === "object" && op in (value as Record<string, unknown>)) {
                value = (value as Record<string, unknown>)[op];
            }
            if ((op === "$in" || op === "$nin") && typeof value === "string") {
                value = value.split(",").map((s) => s.trim()).filter(Boolean);
            }
            if (field.includes(".")) {
                const pathParts = field.split(".");
                if (pathParts.length === 2) {
                    nodes.push({ field, op: op as FilterCondition["op"], value, relation: pathParts[0], relationField: pathParts[1] });
                } else {
                    const relationPath = pathParts;
                    nodes.push({
                        field,
                        op: op as FilterCondition["op"],
                        value,
                        relation: relationPath[0],
                        relationField: relationPath.slice(1).join("."),
                        relationPath,
                    });
                }
            } else {
                nodes.push({ field, op: op as FilterCondition["op"], value });
            }
        }
    }
    if (nodes.length === 0) return undefined;
    if (nodes.length === 1) return nodes[0];
    return { $and: nodes };
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
            out[key] = v;
        }
    }
    return out;
}

function parseSort(raw: string | null): SortItem[] | undefined {
    if (!raw) return undefined;
    const items = raw.split(",").map((p) => p.trim()).filter(Boolean);
    const out: SortItem[] = [];
    for (const item of items) {
        const [field, dirRaw] = item.split(":");
        if (!field) continue;
        const direction: "asc" | "desc" = dirRaw?.toLowerCase() === "desc" ? "desc" : "asc";
        if (field.includes(".")) {
            const pathParts = field.split(".");
            if (pathParts.length === 2) {
                out.push({ field, direction, relation: pathParts[0], relationField: pathParts[1] });
            } else {
                const relationPath = pathParts;
                out.push({ field, direction, relation: relationPath[0], relationField: relationPath.slice(1).join("."), relationPath });
            }
        } else {
            out.push({ field, direction });
        }
    }
    return out.length ? out : undefined;
}

function parseFilter(params: URLSearchParams): FilterNode | undefined {
    const filterEntries = Array.from(params.entries()).filter(([k]) => k.startsWith("filter["));
    if (filterEntries.length === 0) return undefined;
    const root: Record<string, unknown> = {};
    for (const [key, value] of filterEntries) {
        const path = parseBracketPath(key);
        if (path[0] !== "filter") continue;
        setDeep(root, path.slice(1), coerceValue(value));
    }
    return normalizeFilterObject(root);
}

export function parseQueryString(input: URLSearchParams | string | Record<string, unknown>): ListQuery {
    let directFilter: FilterNode | undefined;
    if (
        typeof input === "object" &&
        !(input instanceof URLSearchParams) &&
        input.filter &&
        typeof input.filter === "object" &&
        !Array.isArray(input.filter)
    ) {
        directFilter = normalizeFilterObject(input.filter);
    }

    const params: URLSearchParams =
        input instanceof URLSearchParams
            ? input
            : typeof input === "string"
              ? new URLSearchParams(input.startsWith("?") ? input.slice(1) : input)
              : new URLSearchParams(Object.entries(flatten(input)).map(([k, v]) => [k, String(v)]));

    const rawSearch = params.get("search");
    const search = rawSearch !== null ? rawSearch.replace(/\+/g, " ") : undefined;
    const sort = parseSort(params.get("sort"));

    let filter: FilterNode | undefined;
    if (directFilter) {
        filter = directFilter;
    } else {
        filter = parseFilter(params);
        if (!filter) {
            const filterJson = params.get("filter");
            if (filterJson) {
                try {
                    filter = normalizeFilterObject(JSON.parse(filterJson));
                } catch {
                    // ignore invalid JSON
                }
            }
        }
    }

    const limitRaw = params.get("limit");
    const pageRaw = params.get("page");
    const pagingRaw = params.get("paging");
    const paging = pagingRaw === "false" ? false : pagingRaw === "true" ? true : undefined;

    let limit: number;
    if (paging === false) {
        const maxLimit = CRUD_SPEC.PAGINATION.MAX_LIMIT_UNPAGED;
        const defaultLimit = CRUD_SPEC.PAGINATION.DEFAULT_LIMIT_UNPAGED;
        limit = limitRaw ? Math.min(Math.max(Number(limitRaw), 1), maxLimit) : defaultLimit;
        if (Number.isNaN(limit)) limit = defaultLimit;
    } else {
        const maxLimit = CRUD_SPEC.PAGINATION.MAX_LIMIT_PAGED;
        const defaultLimit = CRUD_SPEC.PAGINATION.DEFAULT_LIMIT;
        limit = limitRaw ? Math.min(Math.max(Number(limitRaw), 1), maxLimit) : defaultLimit;
        if (Number.isNaN(limit)) limit = defaultLimit;
    }

    let page = pageRaw ? Math.max(Number(pageRaw), 1) : CRUD_SPEC.PAGINATION.DEFAULT_PAGE;
    if (Number.isNaN(page)) page = CRUD_SPEC.PAGINATION.DEFAULT_PAGE;

    const debug = params.get("debug") === "true";
    const fieldsRaw = params.get("fields");
    const fields = fieldsRaw ? fieldsRaw.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
    const includeRaw = params.get("include");
    const include = includeRaw ? includeRaw.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

    return { search, sort, filter, limit, page, paging, debug, fields, include };
}
