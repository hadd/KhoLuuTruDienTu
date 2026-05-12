import { t, type TSchema } from "elysia";
import { IdParam } from "@shared/common-lib";
import type { DrizzleServiceOptions } from "./types.ts";

/**
 * Generate response schema for list operations
 */
export function createListResponseSchema<TEntitySchema extends TSchema | undefined>(
    entitySchema?: TEntitySchema,
) {
    return t.Object({
        items: t.Optional(t.Array(entitySchema ?? t.Any())),
        page: t.Optional(t.Number()),
        totalPages: t.Optional(t.Number()),
        limit: t.Optional(t.Number()),
        total: t.Optional(t.Number()),
        hasNextPage: t.Optional(t.Boolean()),
        hasPreviousPage: t.Optional(t.Boolean()),
    });
}

/**
 * Generate response schema for single record operations
 */
export function createRecordResponseSchema<TEntitySchema extends TSchema | undefined>(
    entitySchema?: TEntitySchema,
) {
    return t.Object({
        record: entitySchema ?? t.Any(),
        status: t.Optional(t.Union([t.Literal("created"), t.Literal("updated"), t.Literal("deleted")])),
    });
}

/**
 * Generate API documentation configuration for CRUD endpoints
 */
export function createApiDocs<
    TEntitySchema extends TSchema | undefined,
    TCreateSchema extends TSchema | undefined,
    TUpdateSchema extends TSchema | undefined,
>(
    options: {
        entitySchema?: TEntitySchema;
        createSchema?: TCreateSchema;
        updateSchema?: TUpdateSchema;
        metadata?: DrizzleServiceOptions<TEntitySchema, TCreateSchema, TUpdateSchema>["metadata"];
    },
    routeMetadata?: { tags: string[] },
) {
    const tags = routeMetadata?.tags || options.metadata?.tags || [];
    const getListSchema = () => createListResponseSchema(options.entitySchema);
    const getRecordSchema = () => createRecordResponseSchema(options.entitySchema);

    return {
        tags,
        list: {
            detail: {
                summary: "List records",
                tags,
                response: {
                    200: getListSchema(),
                },
            },
            query: t.Object({
                page: t.Optional(t.Number()),
                limit: t.Optional(t.Number()),
                search: t.Optional(t.String()),
                filter: t.Optional(t.Any()),
                sort: t.Optional(t.Any()),
                paging: t.Optional(t.Boolean()),
            }),
            response: getListSchema(),
        },
        get: {
            detail: {
                summary: "Get a single record by ID",
                tags,
                params: t.Object({
                    id: IdParam(),
                }),
            },
            response: getRecordSchema(),
        },
        create: {
            detail: {
                summary: "Create a new record",
                tags,
                response: {
                    201: getRecordSchema(),
                },
            },
            response: getRecordSchema(),
            body: options.createSchema,
        } as {
            detail: {
                summary: string;
                tags: string[];
                response: {
                    201: ReturnType<typeof getRecordSchema>;
                };
            };
            response: ReturnType<typeof getRecordSchema>;
            body: TCreateSchema;
        },
        update: {
            detail: {
                summary: "Update a record by ID",
                tags,
                response: {
                    200: getRecordSchema(),
                },
            },
            params: t.Object({
                id: IdParam(),
            }),
            response: getRecordSchema(),
            body: options.updateSchema,
        } as {
            detail: {
                summary: string;
                tags: string[];
                response: {
                    200: ReturnType<typeof getRecordSchema>;
                };
            };
            params: ReturnType<typeof t.Object<{ id: ReturnType<typeof IdParam> }>>;
            response: ReturnType<typeof getRecordSchema>;
            body: TUpdateSchema;
        },
        delete: {
            detail: {
                summary: "Delete a record by ID",
                tags,
                response: {
                    200: t.Object({
                        record: t.Any(),
                        status: t.Optional(t.String()),
                    }),
                },
            },
            params: t.Object({
                id: IdParam(),
            }),
            response: t.Object({
                record: t.Any(),
                status: t.Optional(t.String()),
            }),
        },
    };
}
