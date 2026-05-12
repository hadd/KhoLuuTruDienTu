import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { parseQueryString } from "../query.ts";
import { DrizzleBuilder, type QueryContext } from "../drizzle-builder.ts";
import type { PaginatedResult, DatabaseQuery } from "../types.ts";
import { getTableName, toCamelCase, sanitizeWithObject } from "../utils.ts";

export type ListOptions<ID = string | number> = {
    withOverride?: Record<string, unknown>;
    withoutPaging?: boolean;
    internalFilterQuery?: () => SQL | undefined;
    requireJoins?: string[];
};

export type ListOperationContext<ID = string | number> = {
    db: unknown;
    table: any;
    builderContext: QueryContext;
    restrictServiceQuery?: () => SQL;
    relationTables: Record<string, any>;
    relationForeignKeys: Record<string, any>;
    defaultWith?: Record<string, unknown>;
    resolvedQueryKey?: string;
    relationalQueryApi: DatabaseQuery<ID>;
    mapRecord?: (rows: unknown[]) => Promise<unknown[]> | unknown[];
};

/**
 * Execute a paginated list query with optional relations
 */
export async function executeListOperation<Entity, ID extends string | number = string | number>(
    context: ListOperationContext<ID>,
    query: Record<string, unknown>,
    options?: ListOptions<ID>,
): Promise<PaginatedResult<Entity>> {
    const {
        db,
        table,
        builderContext,
        restrictServiceQuery,
        relationTables,
        relationForeignKeys,
        defaultWith,
        resolvedQueryKey,
        mapRecord,
    } = context;

    const { withOverride, withoutPaging, internalFilterQuery, requireJoins } = options || {};
    const parsedQuery = parseQueryString(query);
    const disablePaging = withoutPaging || parsedQuery.paging === false;

    const extraFilters: SQL[] = [];
    if (restrictServiceQuery) {
        extraFilters.push(restrictServiceQuery());
    }
    if (internalFilterQuery) {
        const filterSql = internalFilterQuery();
        if (filterSql) {
            extraFilters.push(filterSql);
        }
    }

    const conditions = DrizzleBuilder.buildWhere(
        builderContext,
        parsedQuery?.filter,
        parsedQuery?.search,
        extraFilters,
    );

    const debug = (parsedQuery as any)?.debug;
    if (debug) {
        console.log("[BaseService Debug] Parsed query:", JSON.stringify(parsedQuery, null, 2));
        console.log("[BaseService Debug] Conditions count:", conditions.length);
    }

    if ((table as any).deletedAt) {
        conditions.push(isNull((table as any).deletedAt));
    }

    const orderBy = DrizzleBuilder.buildOrderBy(
        builderContext,
        parsedQuery?.sort,
        (table as any).createdAt,
    );
    const limit = parsedQuery?.limit ?? (disablePaging ? 10 : 50);
    const page = disablePaging ? 1 : (parsedQuery?.page ?? 1);
    const offset = disablePaging ? 0 : (page - 1) * limit;
    const where = conditions.length ? and(...conditions) : undefined;

    const requiresJoins = Object.keys(relationTables).length > 0 && (
        DrizzleBuilder.needsJoins(parsedQuery?.filter) ||
        DrizzleBuilder.sortNeedsJoins(parsedQuery?.sort) ||
        DrizzleBuilder.searchNeedsJoins(builderContext, parsedQuery?.search) ||
        (requireJoins && requireJoins.length > 0)
    );

    let countQuery = (db as any).select({ count: sql<number>`cast(count(*) as int)` }).from(table as any);
    let selectQuery = (db as any).select({ id: (table as any).id }).from(table as any);

    if (requiresJoins) {
        const relationSearchNeedsJoins = DrizzleBuilder.searchNeedsJoins(builderContext, parsedQuery?.search);
        let relationsToJoin: string[];
        if (requireJoins && requireJoins.length > 0) {
            relationsToJoin = requireJoins;
        } else {
            const filterRelations = DrizzleBuilder.getRelationNamesFromFilter(parsedQuery?.filter, relationTables);
            const sortRelations = DrizzleBuilder.getRelationNamesFromSort(parsedQuery?.sort, builderContext);
            const searchRelations = relationSearchNeedsJoins && builderContext.relationSearchable
                ? new Set(Object.keys(builderContext.relationSearchable).filter((name) => relationTables[name]))
                : new Set<string>();
            relationsToJoin = [...new Set([...filterRelations, ...sortRelations, ...searchRelations])];
        }

        const relationsToJoinSet = new Set(relationsToJoin);
        
        for (const relationName of relationsToJoin) {
            const explicitFk = relationForeignKeys[relationName];
            if (explicitFk) {
                try {
                    const fkTable = (explicitFk as any).table;
                    const fkTableName = getTableName(fkTable);
                    const relationTable = relationTables[relationName];
                    const relationTableName = getTableName(relationTable);
                    
                    if (fkTableName && fkTableName !== relationTableName) {
                        const intermediateRelationName = Object.keys(relationTables).find(
                            name => getTableName(relationTables[name]) === fkTableName
                        );
                        if (intermediateRelationName && !relationsToJoinSet.has(intermediateRelationName)) {
                            relationsToJoinSet.add(intermediateRelationName);
                        }
                    }
                } catch (_error: any) {
                    console.error(
                        `Error processing relation "${relationName}" in list operation:`,
                        {
                            relationName,
                            explicitFk,
                            availableRelationTables: Object.keys(relationTables),
                            error: _error,
                        }
                    );
                }
            }
        }
        
        const joinedTables = new Set<string>();
        
        const joinTable = (tableToJoin: any, joinCondition: any) => {
            const tableName = getTableName(tableToJoin);
            if (tableName && joinedTables.has(tableName)) {
                return;
            }
            countQuery = countQuery.leftJoin(tableToJoin, joinCondition);
            selectQuery = selectQuery.leftJoin(tableToJoin, joinCondition);
            if (tableName) {
                joinedTables.add(tableName);
            }
        };
        
        const relationDependencies = new Map<string, string[]>();
        for (const relationName of Array.from(relationsToJoinSet)) {
            const explicitFk = relationForeignKeys[relationName];
            if (explicitFk) {
                try {
                    const fkTable = (explicitFk as any).table;
                    const fkTableName = getTableName(fkTable);
                    const relationTable = relationTables[relationName];
                    const relationTableName = getTableName(relationTable);
                    
                    if (fkTableName && fkTableName !== relationTableName) {
                        const intermediateRelationName = Object.keys(relationTables).find(
                            name => getTableName(relationTables[name]) === fkTableName
                        );
                        if (intermediateRelationName) {
                            const deps = relationDependencies.get(relationName) || [];
                            deps.push(intermediateRelationName);
                            relationDependencies.set(relationName, deps);
                        }
                    }
                } catch (_error: any) {
                    console.error(
                        `Error processing relation "${relationName}" in list operation:`,
                        {
                            relationName,
                            explicitFk,
                            availableRelationTables: Object.keys(relationTables),
                            error: _error,
                        }
                    );
                }
            }
        }
        
        const sortedRelations: string[] = [];
        const processed = new Set<string>();
        
        const processRelation = (name: string) => {
            if (processed.has(name)) return;
            const deps = relationDependencies.get(name) || [];
            for (const dep of deps) {
                if (relationsToJoinSet.has(dep)) {
                    processRelation(dep);
                }
            }
            sortedRelations.push(name);
            processed.add(name);
        };
        
        for (const relationName of Array.from(relationsToJoinSet)) {
            processRelation(relationName);
        }
        
        relationsToJoin = sortedRelations;
        
        for (const relationName of relationsToJoin) {
            const relationTable = relationTables[relationName];
            if (!relationTable) continue;

            const explicitFk = relationForeignKeys[relationName];
            
            if (explicitFk) {
                try {
                    const fkTable = (explicitFk as any).table;
                    const fkTableName = getTableName(fkTable);
                    const relationTableName = getTableName(relationTable);
                    const isFkOnRelationTable = fkTable === relationTable || 
                        fkTableName === relationTableName;
                    
                    if (isFkOnRelationTable) {
                        joinTable(relationTable, eq(explicitFk, (table as any).id));
                    } else {
                        const intermediateTableName = fkTableName;
                        const intermediateRelationName = Object.keys(relationTables).find(
                            name => getTableName(relationTables[name]) === intermediateTableName
                        );
                        
                        if (intermediateRelationName && intermediateTableName !== relationTableName) {
                            const intermediateTable = relationTables[intermediateRelationName];
                            const intermediateFkName = `${intermediateRelationName}Id`;
                            const intermediateFkCol = (table as any)[intermediateFkName];
                            
                            if (intermediateFkCol) {
                                joinTable(intermediateTable, eq(intermediateFkCol, intermediateTable.id));
                            }
                        }
                        
                        joinTable(relationTable, eq(explicitFk, relationTable.id));
                    }
                } catch {
                    joinTable(relationTable, eq(explicitFk, (table as any).id));
                }
                continue;
            }

            const fkNameInMain = `${relationName}Id`;
            const fkColInMain = (table as any)[fkNameInMain];

            const mainTableName = getTableName(table);
            const fkNameInRelation = (mainTableName && typeof mainTableName === "string")
                ? `${toCamelCase(mainTableName)}Id`
                : null;
            const fkColInRelation = fkNameInRelation ? (relationTable as any)[fkNameInRelation] : null;

            if (fkColInMain) {
                joinTable(relationTable, eq(fkColInMain, relationTable.id));
            } else if (fkColInRelation) {
                joinTable(relationTable, eq(fkColInRelation, (table as any).id));
            }
        }
    }

    if (where) {
        countQuery = countQuery.where(where as SQL);
        selectQuery = selectQuery.where(where as SQL);
    }

    if (debug) {
        try {
            const countSQL = countQuery.toSQL();
            console.log("[BaseService Debug] Count Query SQL:", countSQL.sql);
            console.log("[BaseService Debug] Count Query Params:", countSQL.params);
        } catch (_e) {
            console.log("[BaseService Debug] Could not extract count query SQL");
        }
    }

    let count = 0;
    if (!disablePaging) {
        const [{ count: totalCount }] = await countQuery;
        count = totalCount;
        if (debug) console.log("[BaseService Debug] Total count:", count);
    }
    
    if (debug) {
        const selectSQL = selectQuery.orderBy(...orderBy).limit(limit).offset(offset).toSQL();
        console.log("[BaseService Debug] Select Query SQL:", selectSQL.sql);
        console.log("[BaseService Debug] Select Query Params:", selectSQL.params);
  
    }

    const idRows: { id: ID }[] = await selectQuery
        .orderBy(...orderBy)
        .limit(limit)
        .offset(offset);

    const ids = idRows.map((r) => r.id);
    const totalPages = disablePaging ? 1 : Math.max(Math.ceil(count / limit), 1);
    const hasNextPage = disablePaging ? false : (page < totalPages);
    const hasPreviousPage = disablePaging ? false : (page > 1);

    if (debug) {
        console.log("[BaseService Debug] Found IDs:", ids);
        console.log("[BaseService Debug] IDs count:", ids.length);
    }

    if (ids.length === 0) {
        return {
            items: [] as unknown as Entity[],
            page,
            totalPages,
            limit,
            total: disablePaging ? 0 : count,
            hasNextPage,
            hasPreviousPage,
            ...(parsedQuery ? { query: parsedQuery } : {}),
        };
    }

    const effectiveWith = withOverride ?? defaultWith ?? {};
    const sanitizedWith = sanitizeWithObject(effectiveWith);
    
    if (debug) {
        console.log("[BaseService Debug] Effective with:", JSON.stringify(effectiveWith, null, 2));
        console.log("[BaseService Debug] Sanitized with:", JSON.stringify(sanitizedWith, null, 2));
    }

    const relRows: Entity[] | undefined = await (db as any).query?.[resolvedQueryKey as string]?.findMany?.({
        where: (row: { id: ID }, { inArray }: any) => inArray(row.id, ids as ID[]),
        with: sanitizedWith,
    });

    let ordered: Entity[];
    if (relRows !== undefined && relRows.length > 0) {
        const byId = new Map<any, Entity>((relRows as any[]).map((r) => [(r as any).id, r]));
        ordered = ids.map((id) => byId.get(id)).filter(Boolean) as Entity[];
    } else {
        const idConditions = [inArray((table as any).id, ids as ID[])];
        const finalWhere = where ? and(where as SQL, ...idConditions) : and(...idConditions);
        const basicRows: Entity[] = await (db as any)
            .select()
            .from(table as any)
            .where(finalWhere)
            .orderBy(...orderBy);
        const byId = new Map<any, Entity>((basicRows as any[]).map((r) => [(r as any).id, r]));
        ordered = ids.map((id) => byId.get(id)).filter(Boolean) as Entity[];
    }
    const mappedSorted = mapRecord
        ? await Promise.resolve(mapRecord(ordered as unknown[])) as unknown as Entity[]
        : ordered;

    return {
        items: mappedSorted,
        page,
        totalPages,
        limit,
        total: disablePaging ? ids.length : count,
        hasNextPage,
        hasPreviousPage,
        ...(parsedQuery ? { query: parsedQuery } : {}),
    };
}
