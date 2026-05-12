import { and, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { buildDrizzleQuery } from "../../build/drizzle-query-builder.ts";
import type { ListQuery } from "../../parse/types.ts";
import { parseQueryString } from "../../parse/query-parser.ts";
import type { IBaseRepository } from "../interface.ts";
import type {
    CreateOptions,
    DeleteOptions,
    GetByIdOptions,
    ListOptions,
    UpdateOptions,
} from "../interface.ts";
import type { PaginatedPageInfo } from "../types.ts";
import { ListResult } from "../list-result.ts";
import { ListQueryBuilder } from "../query-builder.ts";
import { getTableName, inferRelationalQueryKey, sanitizeWithObject, toCamelCase } from "../../utils/table-utils.ts";
import { validateId } from "../../utils/validate-id.ts";
import type { BaseRepoConfig } from "./drizzle-context.ts";
import { configToQueryContext } from "./drizzle-context.ts";

function actorId(a: { id: string } | string): string {
    return typeof a === "string" ? a : a.id;
}

function mergeWith(
    defaultWith: Record<string, unknown> | undefined,
    override: Record<string, unknown> | undefined,
): Record<string, unknown> {
    const base = defaultWith ?? {};
    if (!override || typeof override !== "object") return base;
    return { ...base, ...override };
}

function hasDeletedAt(table: any): boolean {
    return !!(table?.deletedAt ?? (table as any).deletedAt);
}

function hasUpdatedAt(table: any): boolean {
    return !!(table?.updatedAt ?? (table as any).updatedAt);
}

function useSoftDelete(config: BaseRepoConfig, table: any): boolean {
    if (config.softDelete === false) return false;
    if (config.softDelete === true) return true;
    return hasDeletedAt(table);
}

export class DrizzleBaseRepository<T> implements IBaseRepository<T> {
    constructor(private readonly config: BaseRepoConfig) {}

    parseQuery(params?: Record<string, unknown>): ListQueryBuilder {
        return new ListQueryBuilder(params, this.config.defaultWith);
    }

    async list(
        query: ListQuery | ListQueryBuilder,
        options?: ListOptions,
    ): Promise<ListResult<T>> {
        const { items, pageInfo } = await this.executeList(query, true, options);
        return new ListResult(items as T[], pageInfo);
    }

    async page(
        query: ListQuery | ListQueryBuilder,
        options?: ListOptions,
    ): Promise<PaginatedPageInfo> {
        const { pageInfo } = await this.executeList(query, false, options);
        return pageInfo;
    }

    private async executeList(
        query: ListQuery | ListQueryBuilder,
        fetchItems: boolean,
        options?: ListOptions,
    ): Promise<{ items: T[]; pageInfo: PaginatedPageInfo }> {
        let listQuery: ListQuery;
        let directWhere: SQL[] = [];
        let mergedWith: Record<string, unknown> | undefined;

        if (query instanceof ListQueryBuilder) {
            listQuery = query.build();
            directWhere = query.getDirectWhere();
            mergedWith = query.getMergedWith();
        } else {
            listQuery =
                typeof query === "object" && query !== null && "filter" in query
                    ? (query as ListQuery)
                    : parseQueryString(query as Record<string, unknown>);
        }

        const context = configToQueryContext(this.config);
        const extraFilters: SQL[] = [];

        if (this.config.appliedForOnlyMatchedQuery) {
            const filterSql = this.config.appliedForOnlyMatchedQuery();
            if (filterSql) extraFilters.push(filterSql);
        }

        const table = this.config.table as any;
        if (hasDeletedAt(table) && !options?.includedSoftDelete) {
            extraFilters.push(isNull(table.deletedAt));
        }

        const drizzleQuery = buildDrizzleQuery(
            listQuery,
            context,
            extraFilters,
            directWhere.length ? directWhere : undefined,
        );

        const db = (options?.transaction ?? this.config.db) as any;
        const { defaultWith, mapRecord } = this.config;
        const disablePaging = listQuery.paging === false;
        const limit = drizzleQuery.limit;
        const page = listQuery.page ?? 1;
        const offset = drizzleQuery.offset;
        const where = drizzleQuery.where;

        const relationTables = this.config.relationTables ?? {};
        const relationForeignKeys = this.config.relationForeignKeys ?? {};
        const requireJoins = drizzleQuery.requireJoins;

        let countQuery: any = db.select({ count: sql<number>`cast(count(*) as int)` }).from(table);
        let selectQuery: any = db.select({ id: table.id }).from(table);

        if (requireJoins.length > 0) {
            for (const relationName of requireJoins) {
                const relationTable = relationTables[relationName];
                if (!relationTable) continue;

                const explicitFk = relationForeignKeys[relationName];
                if (explicitFk) {
                    try {
                        const fkTable = (explicitFk as any).table;
                        const fkTableName = getTableName(fkTable);
                        const relationTableName = getTableName(relationTable);
                        const isFkOnRelationTable =
                            fkTable === relationTable || fkTableName === relationTableName;
                        if (isFkOnRelationTable) {
                            countQuery = countQuery.leftJoin(relationTable, eq(explicitFk, table.id));
                            selectQuery = selectQuery.leftJoin(relationTable, eq(explicitFk, table.id));
                        } else {
                            const intermediateRelationName = Object.keys(relationTables).find(
                                (name) => getTableName(relationTables[name]) === fkTableName,
                            );
                            if (intermediateRelationName && fkTableName !== relationTableName) {
                                const intermediateTable = relationTables[intermediateRelationName];
                                const intermediateFkName = `${intermediateRelationName}Id`;
                                const intermediateFkCol = table[intermediateFkName];
                                if (intermediateFkCol) {
                                    countQuery = countQuery.leftJoin(
                                        intermediateTable,
                                        eq(intermediateFkCol, intermediateTable.id),
                                    );
                                    selectQuery = selectQuery.leftJoin(
                                        intermediateTable,
                                        eq(intermediateFkCol, intermediateTable.id),
                                    );
                                }
                            }
                            countQuery = countQuery.leftJoin(relationTable, eq(explicitFk, relationTable.id));
                            selectQuery = selectQuery.leftJoin(relationTable, eq(explicitFk, relationTable.id));
                        }
                    } catch {
                        countQuery = countQuery.leftJoin(relationTable, eq(explicitFk, table.id));
                        selectQuery = selectQuery.leftJoin(relationTable, eq(explicitFk, table.id));
                    }
                    continue;
                }

                const mainTableName = getTableName(table);
                const fkNameInMain = `${relationName}Id`;
                const fkColInMain = table[fkNameInMain];
                const fkNameInRelation =
                    mainTableName && typeof mainTableName === "string"
                        ? `${toCamelCase(mainTableName)}Id`
                        : null;
                const fkColInRelation = fkNameInRelation
                    ? (relationTable as any)[fkNameInRelation]
                    : null;

                if (fkColInMain) {
                    countQuery = countQuery.leftJoin(relationTable, eq(fkColInMain, relationTable.id));
                    selectQuery = selectQuery.leftJoin(relationTable, eq(fkColInMain, relationTable.id));
                } else if (fkColInRelation) {
                    countQuery = countQuery.leftJoin(relationTable, eq(fkColInRelation, table.id));
                    selectQuery = selectQuery.leftJoin(relationTable, eq(fkColInRelation, table.id));
                }
            }
        }

        if (where) {
            countQuery = countQuery.where(where as SQL);
            selectQuery = selectQuery.where(where as SQL);
        }

        let totalCount = 0;
        if (!disablePaging) {
            const [{ count }] = await countQuery;
            totalCount = count;
        }

        const idRows: { id: string | number }[] = await selectQuery
            .orderBy(...drizzleQuery.orderBy)
            .limit(limit)
            .offset(offset);

        const ids = idRows.map((r) => r.id);
        const totalPages = disablePaging ? 1 : Math.max(Math.ceil(totalCount / limit), 1);
        const hasNextPage = disablePaging ? false : page < totalPages;
        const hasPreviousPage = disablePaging ? false : page > 1;

        const pageInfo: PaginatedPageInfo = {
            page,
            totalPages,
            limit,
            total: disablePaging ? ids.length : totalCount,
            hasNextPage,
            hasPreviousPage,
        };

        if (!fetchItems) return { items: [], pageInfo };
        if (ids.length === 0) return { items: [] as T[], pageInfo };

        const effectiveWith = mergeWith(defaultWith, mergedWith as Record<string, unknown>);
        const sanitizedWith = sanitizeWithObject(effectiveWith);
        const queryKeys = Object.keys(db.query ?? {});
        const resolvedQueryKey = inferRelationalQueryKey(table, queryKeys);

        let ordered: T[];

        if (resolvedQueryKey && sanitizedWith && Object.keys(sanitizedWith).length > 0) {
            const relRows: any[] = await db.query[resolvedQueryKey].findMany({
                where: (row: { id: string | number }, { inArray: ia }: any) => ia(row.id, ids),
                with: sanitizedWith,
            });
            const byId = new Map(relRows.map((r) => [r.id, r]));
            ordered = ids.map((id) => byId.get(id)).filter(Boolean) as T[];
        } else {
            const idConditions = inArray(table.id, ids);
            const finalWhere = where ? and(where as SQL, idConditions) : idConditions;
            const basicRows: any[] = await db
                .select()
                .from(table)
                .where(finalWhere)
                .orderBy(...drizzleQuery.orderBy);
            const byId = new Map(basicRows.map((r) => [r.id, r]));
            ordered = ids.map((id) => byId.get(id)).filter(Boolean) as T[];
        }

        const mapped = mapRecord
            ? ((await Promise.resolve(mapRecord(ordered as unknown[]))) as T[])
            : ordered;

        return { items: mapped, pageInfo };
    }

    private conditionsForGetUpdateDelete(
        id: string | number,
        options?: { includedSoftDelete?: boolean; where?: SQL },
    ): SQL[] {
        const table = this.config.table as any;
        const conds: SQL[] = [eq(table.id, id)];

        if (this.config.appliedForOnlyMatchedQuery) {
            const q = this.config.appliedForOnlyMatchedQuery();
            if (q) conds.push(q);
        }

        if (hasDeletedAt(table) && !options?.includedSoftDelete) {
            conds.push(isNull(table.deletedAt));
        }

        if (options?.where) conds.push(options.where as SQL);
        return conds;
    }

    async findById(id: string | number, options?: GetByIdOptions): Promise<T | null> {
        validateId(id);
        const db = (options?.transaction ?? this.config.db) as any;
        const table = this.config.table as any;
        const conds = this.conditionsForGetUpdateDelete(id, {
            includedSoftDelete: options?.includedSoftDelete,
            where: options?.where,
        });

        const rows: any[] = await db
            .select()
            .from(table)
            .where(and(...conds))
            .limit(1);

        const row = rows[0];
        if (!row) return null;

        const defaultWith = this.config.defaultWith ?? {};
        const effectiveWith = mergeWith(defaultWith, options?.with);
        const sanitizedWith = sanitizeWithObject(effectiveWith);
        const queryKeys = Object.keys(db.query ?? {});
        const resolvedQueryKey = inferRelationalQueryKey(table, queryKeys);

        if (resolvedQueryKey && sanitizedWith && Object.keys(sanitizedWith).length > 0) {
            const relRows: any[] = await db.query[resolvedQueryKey].findMany({
                where: (r: { id: string | number }, { inArray: ia }: any) => ia(r.id, [id]),
                with: sanitizedWith,
            });
            const rel = relRows?.[0] ?? row;
            const mapped = this.config.mapRecord
                ? await Promise.resolve(this.config.mapRecord([rel]))
                : undefined;
            return ((mapped?.[0] as T) ?? rel) as T;
        }

        const mapped = this.config.mapRecord
            ? await Promise.resolve(this.config.mapRecord([row]))
            : undefined;
        return ((mapped?.[0] as T) ?? row) as T;
    }

    async getOne(id: string | number, options?: GetByIdOptions): Promise<T> {
        const row = await this.findById(id, options);
        if (row == null) throw new Error("Not found");
        return row;
    }

    async create(
        data: Record<string, unknown>,
        options?: CreateOptions,
    ): Promise<T> {
        const db = (options?.transaction ?? this.config.db) as any;
        const table = this.config.table as any;
        const ac = this.config.actorColumns;
        const createdByCol = ac?.createdBy ?? (table.createdBy !== undefined ? "createdBy" : null);

        const insertData = { ...data } as Record<string, unknown>;
        if (options?.actor && createdByCol) {
            insertData[createdByCol] = actorId(options.actor);
        }

        const [row]: any[] = await db.insert(table).values(insertData).returning();
        if (!row) throw new Error("Create failed");

        const defaultWith = this.config.defaultWith ?? {};
        const effectiveWith = mergeWith(defaultWith, options?.with);
        const sanitizedWith = sanitizeWithObject(effectiveWith);
        const queryKeys = Object.keys(db.query ?? {});
        const resolvedQueryKey = inferRelationalQueryKey(table, queryKeys);

        if (resolvedQueryKey && sanitizedWith && Object.keys(sanitizedWith).length > 0) {
            const relRows: any[] = await db.query[resolvedQueryKey].findMany({
                where: (r: { id: string | number }, { inArray: ia }: any) => ia(r.id, [row.id]),
                with: sanitizedWith,
            });
            const rel = relRows?.[0] ?? row;
            const mapped = this.config.mapRecord
                ? await Promise.resolve(this.config.mapRecord([rel]))
                : undefined;
            return ((mapped?.[0] as T) ?? rel) as T;
        }

        const mapped = this.config.mapRecord
            ? await Promise.resolve(this.config.mapRecord([row]))
            : undefined;
        return ((mapped?.[0] as T) ?? row) as T;
    }

    async update(
        id: string | number,
        data: Record<string, unknown>,
        options?: UpdateOptions,
    ): Promise<T> {
        validateId(id);
        const db = (options?.transaction ?? this.config.db) as any;
        const table = this.config.table as any;
        const conds = this.conditionsForGetUpdateDelete(id, {
            includedSoftDelete: options?.includedSoftDelete,
            where: options?.where,
        });

        const ac = this.config.actorColumns;
        const updatedByCol = ac?.updatedBy ?? (table.updatedBy !== undefined ? "updatedBy" : null);

        const setData: Record<string, unknown> = { ...data };
        if (hasUpdatedAt(table)) setData.updatedAt = new Date();
        if (options?.actor && updatedByCol) setData[updatedByCol] = actorId(options.actor);

        const rows: any[] = await db
            .update(table)
            .set(setData)
            .where(and(...conds))
            .returning();

        const row = rows[0];
        if (!row) throw new Error("Not found");

        const defaultWith = this.config.defaultWith ?? {};
        const effectiveWith = mergeWith(defaultWith, options?.with);
        const sanitizedWith = sanitizeWithObject(effectiveWith);
        const queryKeys = Object.keys(db.query ?? {});
        const resolvedQueryKey = inferRelationalQueryKey(table, queryKeys);

        if (resolvedQueryKey && sanitizedWith && Object.keys(sanitizedWith).length > 0) {
            const relRows: any[] = await db.query[resolvedQueryKey].findMany({
                where: (r: { id: string | number }, { inArray: ia }: any) => ia(r.id, [id]),
                with: sanitizedWith,
            });
            const rel = relRows?.[0] ?? row;
            const mapped = this.config.mapRecord
                ? await Promise.resolve(this.config.mapRecord([rel]))
                : undefined;
            return ((mapped?.[0] as T) ?? rel) as T;
        }

        const mapped = this.config.mapRecord
            ? await Promise.resolve(this.config.mapRecord([row]))
            : undefined;
        return ((mapped?.[0] as T) ?? row) as T;
    }

    async delete(id: string | number, options?: DeleteOptions): Promise<{ id: string | number }> {
        validateId(id);
        const db = (options?.transaction ?? this.config.db) as any;
        const table = this.config.table as any;
        const softDelete = useSoftDelete(this.config, table);

        const conds: SQL[] = [eq(table.id, id)];

        if (options?.forceDelete) {
            if (this.config.appliedForOnlyMatchedQuery) {
                const q = this.config.appliedForOnlyMatchedQuery();
                if (q) conds.push(q);
            }
            if (options.where) conds.push(options.where as SQL);
        } else {
            if (this.config.appliedForOnlyMatchedQuery) {
                const q = this.config.appliedForOnlyMatchedQuery();
                if (q) conds.push(q);
            }
            if (hasDeletedAt(table) && !options?.includedSoftDelete) {
                conds.push(isNull(table.deletedAt));
            }
            if (options?.where) conds.push(options.where as SQL);
        }

        if (softDelete && !options?.forceDelete) {
            const ac = this.config.actorColumns;
            const updatedByCol = ac?.updatedBy ?? (table.updatedBy !== undefined ? "updatedBy" : null);
            const setData: Record<string, unknown> = {
                deletedAt: new Date(),
                ...(hasUpdatedAt(table) ? { updatedAt: new Date() } : {}),
            };
            if (options?.actor && updatedByCol) setData[updatedByCol] = actorId(options.actor);

            const rows: any[] = await db
                .update(table)
                .set(setData)
                .where(and(...conds))
                .returning({ id: table.id });

            const row = rows[0];
            if (!row) throw new Error("Not found");
            return { id: row.id };
        }

        const rows: any[] = await db
            .delete(table)
            .where(and(...conds))
            .returning({ id: table.id });

        const row = rows[0];
        if (!row) throw new Error("Not found");
        return { id: row.id };
    }
}
