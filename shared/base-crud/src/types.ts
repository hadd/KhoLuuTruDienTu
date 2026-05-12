import type { SQL } from "drizzle-orm";
import type { TSchema } from "elysia";
import type { ListQuery } from "./query.ts";

/**
 * Type utilities for schema-driven inference
 */
export type InferStatic<T> = T extends TSchema ? T['static'] : any;
export type IfDefined<T, A, B> = undefined extends T ? B : A;

/**
 * Paginated list response structure
 */
export type PaginatedResult<T> = {
    items: T[];
    page: number;
    totalPages: number;
    limit: number;
    total: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    query?: ListQuery;
};

/**
 * Single record response structure
 */
export type CrudRecordResponse<Entity> = {
    record: Entity;
    status?: "created" | "updated" | "deleted";
};

/**
 * Service configuration options for creating a CRUD service
 */
export type DrizzleServiceOptions<
    TEntitySchema extends TSchema | undefined = undefined,
    TCreateSchema extends TSchema | undefined = undefined,
    TUpdateSchema extends TSchema | undefined = undefined,
    TableType = any,
> = {
    db: unknown;
    table: TableType;
    searchable?: Array<keyof InferStatic<TEntitySchema> & string>;
    returning?: TableType;
    createSchema?: TCreateSchema;
    updateSchema?: TUpdateSchema;
    entitySchema?: TEntitySchema;
    restrictServiceQuery?: () => SQL;
    defaultWith?: Record<string, unknown>;
    relationTables?: Record<string, any>;
    relationForeignKeys?: Record<string, any>;
    relationSearchable?: Record<string, string[]>;
    mapRecord?: (rows: unknown[]) => Promise<unknown[]> | unknown[];
    metadata?: {
        tags?: string[];
        descriptions?: {
            list?: string;
            get?: string;
            create?: string;
            update?: string;
            delete?: string;
        };
    };
};

/**
 * Relational query API types
 */
export type RelationalQueryApi<ID = string | number> = {
    findMany?: (
        args: { 
            where?: (row: { id: ID }, operators: RelationalOperators<ID>) => SQL; 
            with?: Record<string, unknown> 
        },
    ) => Promise<unknown[]>;
};

export type RelationalOperators<ID = string | number> = {
    inArray: (column: unknown, values: ID[]) => SQL;
};

export type DatabaseQuery<ID = string | number> = Record<string, RelationalQueryApi<ID>>;

/**
 * Infer the entity type from a CRUD service's `get` method
 */
export type InferServiceEntity<T> = T extends { get: (...args: any[]) => Promise<infer E> } 
    ? E 
    : never;

/**
 * Infer the list response type from a CRUD service's `list` method
 */
export type InferServiceListResponse<T> = T extends { list: (...args: any[]) => Promise<infer R> } 
    ? R 
    : never;

