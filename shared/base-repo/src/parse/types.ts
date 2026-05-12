import type { FilterOperator } from "../spec/crud-api.ts";

export interface FilterCondition {
    field: string;
    op: FilterOperator;
    value: unknown;
    relation?: string;
    relationField?: string;
    relationPath?: string[];
}

export type FilterNode =
    | FilterCondition
    | { $and?: FilterNode[]; $or?: FilterNode[] };

export interface SortItem {
    field: string;
    direction: "asc" | "desc";
    relation?: string;
    relationField?: string;
    relationPath?: string[];
}

export interface ListQuery {
    filter?: FilterNode;
    sort?: SortItem[];
    search?: string;
    page?: number;
    limit?: number;
    paging?: boolean;
    fields?: string[];
    include?: string[];
    debug?: boolean;
}
