
export interface PaginatedPageInfo {
    page: number;
    totalPages: number;
    limit: number;
    total: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}
