export const CRUD_SPEC = {
    PAGINATION: {
        DEFAULT_PAGE: 1,
        DEFAULT_LIMIT: 50,
        MAX_LIMIT_PAGED: 400,
        MAX_LIMIT_UNPAGED: 50,
        DEFAULT_LIMIT_UNPAGED: 10,
    },
    FILTER_OPERATORS: ["$eq", "$in", "$nin", "$gte", "$lte", "$gt", "$lt"] as const,
    LOGICAL_OPERATORS: ["$and", "$or"] as const,
    SORT_DIRECTIONS: ["asc", "desc"] as const,
} as const;

export type FilterOperator = (typeof CRUD_SPEC.FILTER_OPERATORS)[number];
export type LogicalOperator = (typeof CRUD_SPEC.LOGICAL_OPERATORS)[number];
export type SortDirection = (typeof CRUD_SPEC.SORT_DIRECTIONS)[number];
