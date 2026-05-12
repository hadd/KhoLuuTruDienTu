import type { SQL } from "drizzle-orm";
import type { ListQuery } from "../parse/types.ts";

export interface QueryContext {
    table: any;
    relationTables?: Record<string, any>;
    relationForeignKeys?: Record<string, any>;
    searchable?: string[];
    arrayFields?: Set<string>;
    relationSearchable?: Record<string, string[]>;
}

export interface DrizzleListQuery {
    where: SQL | undefined;
    orderBy: SQL[];
    limit: number;
    offset: number;
    requireJoins: string[];
    parsed: ListQuery;
    metadata?: {
        hasFilters: boolean;
        hasSearch: boolean;
        hasSort: boolean;
        joinDependencies: Map<string, string[]>;
    };
}
