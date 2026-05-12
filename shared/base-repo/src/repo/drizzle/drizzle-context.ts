import type { SQL } from "drizzle-orm";
import type { QueryContext } from "../../build/types.ts";

export interface BaseRepoConfig<TTable = any> {
    db: any;
    table: TTable;
    searchable?: string[];
    relationTables?: Record<string, any>;
    relationForeignKeys?: Record<string, any>;
    arrayFields?: Set<string>;
    relationSearchable?: Record<string, string[]>;
    defaultWith?: Record<string, unknown>;
    appliedForOnlyMatchedQuery?: () => SQL | undefined;
    mapRecord?: (rows: unknown[]) => Promise<unknown[]> | unknown[];
    softDelete?: boolean;
    actorColumns?: { createdBy?: string; updatedBy?: string };
}

export function configToQueryContext(config: BaseRepoConfig): QueryContext {
    return {
        table: config.table,
        relationTables: config.relationTables,
        relationForeignKeys: config.relationForeignKeys,
        searchable: config.searchable as string[] | undefined,
        arrayFields: config.arrayFields,
        relationSearchable: config.relationSearchable,
    };
}
