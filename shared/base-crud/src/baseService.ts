import type { TSchema } from "elysia";
import type {
    DrizzleServiceOptions,
    InferStatic,
    DatabaseQuery,
    PaginatedResult,
} from "./types.ts";
import { inferRelationalQueryKey, inferRelationsFromSchema, detectArrayColumns } from "./utils.ts";
import { type QueryContext } from "./drizzle-builder.ts";
import { createApiDocs, createListResponseSchema, createRecordResponseSchema } from "./schema.ts";
import { executeListOperation, type ListOperationContext, type ListOptions } from "./operations/list.ts";
import { executeGetOperation, type GetOperationContext, type GetOptions } from "./operations/get.ts";
import { executeCreateOperation, type CreateOperationContext } from "./operations/create.ts";
import { executeUpdateOperation, type UpdateOperationContext, type UpdateOptions } from "./operations/update.ts";
import { executeDeleteOperation, type DeleteOperationContext, type DeleteOptions } from "./operations/delete.ts";

/**
 * Create a CRUD service with all standard operations
 */
export function createCrudService<
    TEntitySchema extends TSchema | undefined = undefined,
    TCreateSchema extends TSchema | undefined = undefined,
    TUpdateSchema extends TSchema | undefined = undefined,
    TableType = any,
    ID extends string | number = string | number,
>(
    opts: DrizzleServiceOptions<TEntitySchema, TCreateSchema, TUpdateSchema, TableType>,
) {
    type Entity = InferStatic<TEntitySchema>;
    type CreateInput = InferStatic<TCreateSchema>;
    type UpdateInput = InferStatic<TUpdateSchema>;

    const {
        db,
        table,
        searchable = [],
        createSchema,
        updateSchema,
        entitySchema,
        metadata,
        defaultWith,
        mapRecord,
        relationTables = {},
        relationForeignKeys = {},
        relationSearchable,
        restrictServiceQuery,
    }: DrizzleServiceOptions<TEntitySchema, TCreateSchema, TUpdateSchema, TableType> = opts;

    const relationalQueryApi: DatabaseQuery<ID> =
        ((db as unknown as { query?: DatabaseQuery<ID> })?.query) ?? ({} as DatabaseQuery<ID>);

    const availableQueryKeys = Object.keys(relationalQueryApi);
    const resolvedQueryKey = inferRelationalQueryKey(table, availableQueryKeys);

    const inferredRelations = Object.keys(relationTables).length === 0
        ? inferRelationsFromSchema(db, table)
        : { relationTables: {}, relationForeignKeys: {} };

    const mergedRelationTables = { ...inferredRelations.relationTables, ...relationTables };
    const mergedRelationForeignKeys = { ...inferredRelations.relationForeignKeys, ...relationForeignKeys };

    // Auto-detect array columns from table schema
    const searchableFields = searchable as string[];
    const arrayFields = detectArrayColumns(table, searchableFields);


    const builderContext: QueryContext = {
        table,
        relationTables: mergedRelationTables,
        relationForeignKeys: mergedRelationForeignKeys,
        searchable: searchableFields,
        arrayFields,
        relationSearchable,
    };

    const listContext: ListOperationContext<ID> = {
        db,
        table,
        builderContext,
        restrictServiceQuery,
        relationTables: mergedRelationTables,
        relationForeignKeys: mergedRelationForeignKeys,
        defaultWith,
        resolvedQueryKey,
        relationalQueryApi,
        mapRecord,
    };

    const getContext: GetOperationContext<ID> = {
        db,
        table,
        restrictServiceQuery,
        resolvedQueryKey,
        relationalQueryApi,
        defaultWith,
        mapRecord,
    };

    const createContext: CreateOperationContext<ID> = {
        db,
        table,
        resolvedQueryKey,
        relationalQueryApi,
        defaultWith,
        mapRecord,
    };

    const updateContext: UpdateOperationContext<ID> = {
        db,
        table,
        resolvedQueryKey,
        relationalQueryApi,
        defaultWith,
        mapRecord,
    };

    const deleteContext: DeleteOperationContext<ID> = {
        db,
        table,
        mapRecord,
    };

    const list = async <Row = Entity>(
        query: Record<string, unknown>,
        options?: ListOptions<ID>,
    ): Promise<PaginatedResult<Row>> => {
        return executeListOperation<Row, ID>(listContext, query, options);
    };

    const get = async (
        id: ID,
        options?: GetOptions<ID>,
    ): Promise<Entity> => {
        return executeGetOperation<Entity, ID>(getContext, id, options);
    };

    const create = async (input: CreateInput): Promise<Entity> => {
        return executeCreateOperation<Entity, CreateInput, ID>(createContext, input);
    };

    const update = async (
        id: ID,
        input: UpdateInput,
        options?: UpdateOptions,
    ): Promise<Entity> => {
        return executeUpdateOperation<Entity, UpdateInput, ID>(updateContext, id, input, options);
    };

    const delete_ = async (
        id: ID,
        options?: DeleteOptions,
    ): Promise<{ id: ID }> => {
        return executeDeleteOperation<ID>(deleteContext, id, options);
    };

    const getListResponseSchema = () => createListResponseSchema(entitySchema);
    const getRecordResponseSchema = () => createRecordResponseSchema(entitySchema);

    return {
        list,
        get,
        create,
        update,
        delete: delete_,
        getCreateSchema: () => createSchema,
        getUpdateSchema: () => updateSchema,
        getMetadata: () => metadata,
        getListResponseSchema,
        getRecordResponseSchema,
        getDocs: (routeMetadata?: { tags: string[] }) => {
            return createApiDocs(
                {
                    entitySchema,
                    createSchema,
                    updateSchema,
                    metadata,
                },
                routeMetadata,
            );
        },
    };
}
