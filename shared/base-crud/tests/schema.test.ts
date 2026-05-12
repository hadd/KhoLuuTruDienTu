import { assertEquals, assertExists } from "@std/assert";
import { t as tBox } from "elysia";
import {
    createListResponseSchema,
    createRecordResponseSchema,
    createApiDocs,
} from "../src/schema.ts";

Deno.test({
    name: "Schema - createListResponseSchema",
    fn: async (t) => {
        await t.step("createListResponseSchema without entitySchema", () => {
            const schema = createListResponseSchema();
            
            assertExists(schema);
            assertExists(schema.properties.items);
            assertExists(schema.properties.page);
            assertExists(schema.properties.totalPages);
            assertExists(schema.properties.limit);
            assertExists(schema.properties.total);
            assertExists(schema.properties.hasNextPage);
            assertExists(schema.properties.hasPreviousPage);
        });

        await t.step("createListResponseSchema with entitySchema", () => {
            const entitySchema = tBox.Object({
                id: tBox.Number(),
                name: tBox.String(),
            });
            const schema = createListResponseSchema(entitySchema);
            
            assertExists(schema);
            assertExists(schema.properties.items);
        });

        await t.step("createListResponseSchema with undefined entitySchema", () => {
            const schema = createListResponseSchema(undefined);
            
            assertExists(schema);
            assertExists(schema.properties.items);
        });
    },
});

Deno.test({
    name: "Schema - createRecordResponseSchema",
    fn: async (t) => {
        await t.step("createRecordResponseSchema without entitySchema", () => {
            const schema = createRecordResponseSchema();
            
            assertExists(schema);
            assertExists(schema.properties.record);
            assertExists(schema.properties.status);
        });

        await t.step("createRecordResponseSchema with entitySchema", () => {
            const entitySchema = tBox.Object({
                id: tBox.Number(),
                name: tBox.String(),
            });
            const schema = createRecordResponseSchema(entitySchema);
            
            assertExists(schema);
            assertExists(schema.properties.record);
            assertEquals(schema.properties.record, entitySchema);
        });

        await t.step("createRecordResponseSchema with undefined entitySchema", () => {
            const schema = createRecordResponseSchema(undefined);
            
            assertExists(schema);
            assertExists(schema.properties.record);
        });

        await t.step("createRecordResponseSchema includes status field", () => {
            const schema = createRecordResponseSchema();
            
            assertExists(schema.properties.status);
            const statusUnion = schema.properties.status as any;
            assertExists(statusUnion.anyOf);
        });
    },
});

Deno.test({
    name: "Schema - createApiDocs",
    fn: async (t) => {
        await t.step("createApiDocs without routeMetadata uses metadata tags", () => {
            const entitySchema = tBox.Object({ id: tBox.Number() });
            const createSchema = tBox.Object({ name: tBox.String() });
            const updateSchema = tBox.Object({ name: tBox.Optional(tBox.String()) });
            
            const docs = createApiDocs({
                entitySchema,
                createSchema,
                updateSchema,
                metadata: {
                    tags: ["test-tag"],
                },
            });
            
            assertEquals(docs.tags, ["test-tag"]);
            assertEquals(docs.list.detail.tags, ["test-tag"]);
            assertEquals(docs.get.detail.tags, ["test-tag"]);
            assertEquals(docs.create.detail.tags, ["test-tag"]);
            assertEquals(docs.update.detail.tags, ["test-tag"]);
            assertEquals(docs.delete.detail.tags, ["test-tag"]);
        });

        await t.step("createApiDocs with routeMetadata uses routeMetadata tags", () => {
            const entitySchema = tBox.Object({ id: tBox.Number() });
            const createSchema = tBox.Object({ name: tBox.String() });
            const updateSchema = tBox.Object({ name: tBox.Optional(tBox.String()) });
            
            const docs = createApiDocs(
                {
                    entitySchema,
                    createSchema,
                    updateSchema,
                    metadata: {
                        tags: ["metadata-tag"],
                    },
                },
                { tags: ["route-tag"] },
            );
            
            assertEquals(docs.tags, ["route-tag"]);
            assertEquals(docs.list.detail.tags, ["route-tag"]);
        });

        await t.step("createApiDocs without metadata or routeMetadata uses empty tags", () => {
            const entitySchema = tBox.Object({ id: tBox.Number() });
            const createSchema = tBox.Object({ name: tBox.String() });
            const updateSchema = tBox.Object({ name: tBox.Optional(tBox.String()) });
            
            const docs = createApiDocs({
                entitySchema,
                createSchema,
                updateSchema,
            });
            
            assertEquals(docs.tags, []);
        });

        await t.step("createApiDocs includes list endpoint configuration", () => {
            const entitySchema = tBox.Object({ id: tBox.Number() });
            const createSchema = tBox.Object({ name: tBox.String() });
            const updateSchema = tBox.Object({ name: tBox.Optional(tBox.String()) });
            
            const docs = createApiDocs({
                entitySchema,
                createSchema,
                updateSchema,
            });
            
            assertExists(docs.list);
            assertEquals(docs.list.detail.summary, "List records");
            assertExists(docs.list.query);
            assertExists(docs.list.response);
        });

        await t.step("createApiDocs includes get endpoint configuration", () => {
            const entitySchema = tBox.Object({ id: tBox.Number() });
            const createSchema = tBox.Object({ name: tBox.String() });
            const updateSchema = tBox.Object({ name: tBox.Optional(tBox.String()) });
            
            const docs = createApiDocs({
                entitySchema,
                createSchema,
                updateSchema,
            });
            
            assertExists(docs.get);
            assertEquals(docs.get.detail.summary, "Get a single record by ID");
            assertExists(docs.get.detail.params);
            assertExists(docs.get.response);
        });

        await t.step("createApiDocs includes create endpoint configuration", () => {
            const entitySchema = tBox.Object({ id: tBox.Number() });
            const createSchema = tBox.Object({ name: tBox.String() });
            const updateSchema = tBox.Object({ name: tBox.Optional(tBox.String()) });
            
            const docs = createApiDocs({
                entitySchema,
                createSchema,
                updateSchema,
            });
            
            assertExists(docs.create);
            assertEquals(docs.create.detail.summary, "Create a new record");
            assertExists(docs.create.detail.response);
            assertEquals(docs.create.body, createSchema);
        });

        await t.step("createApiDocs includes update endpoint configuration", () => {
            const entitySchema = tBox.Object({ id: tBox.Number() });
            const createSchema = tBox.Object({ name: tBox.String() });
            const updateSchema = tBox.Object({ name: tBox.Optional(tBox.String()) });
            
            const docs = createApiDocs({
                entitySchema,
                createSchema,
                updateSchema,
            });
            
            assertExists(docs.update);
            assertEquals(docs.update.detail.summary, "Update a record by ID");
            assertExists(docs.update.detail.response);
            assertEquals(docs.update.body, updateSchema);
        });

        await t.step("createApiDocs includes delete endpoint configuration", () => {
            const entitySchema = tBox.Object({ id: tBox.Number() });
            const createSchema = tBox.Object({ name: tBox.String() });
            const updateSchema = tBox.Object({ name: tBox.Optional(tBox.String()) });
            
            const docs = createApiDocs({
                entitySchema,
                createSchema,
                updateSchema,
            });
            
            assertExists(docs.delete);
            assertEquals(docs.delete.detail.summary, "Delete a record by ID");
            assertExists(docs.delete.response);
        });

        await t.step("createApiDocs with undefined schemas", () => {
            const docs = createApiDocs({
                entitySchema: undefined,
                createSchema: undefined,
                updateSchema: undefined,
            });
            
            assertExists(docs);
            assertExists(docs.list);
            assertExists(docs.get);
            assertExists(docs.create);
            assertExists(docs.update);
            assertExists(docs.delete);
        });

        await t.step("createApiDocs list query includes all parameters", () => {
            const entitySchema = tBox.Object({ id: tBox.Number() });
            const createSchema = tBox.Object({ name: tBox.String() });
            const updateSchema = tBox.Object({ name: tBox.Optional(tBox.String()) });
            
            const docs = createApiDocs({
                entitySchema,
                createSchema,
                updateSchema,
            });
            
            const querySchema = docs.list.query as any;
            assertExists(querySchema.properties.page);
            assertExists(querySchema.properties.limit);
            assertExists(querySchema.properties.search);
            assertExists(querySchema.properties.filter);
            assertExists(querySchema.properties.sort);
            assertExists(querySchema.properties.paging);
        });

        await t.step("createApiDocs create response includes 201 status", () => {
            const entitySchema = tBox.Object({ id: tBox.Number() });
            const createSchema = tBox.Object({ name: tBox.String() });
            const updateSchema = tBox.Object({ name: tBox.Optional(tBox.String()) });
            
            const docs = createApiDocs({
                entitySchema,
                createSchema,
                updateSchema,
            });
            
            assertExists(docs.create.detail.response);
            assertExists((docs.create.detail.response as any)[201]);
        });

        await t.step("createApiDocs update response includes 200 status", () => {
            const entitySchema = tBox.Object({ id: tBox.Number() });
            const createSchema = tBox.Object({ name: tBox.String() });
            const updateSchema = tBox.Object({ name: tBox.Optional(tBox.String()) });
            
            const docs = createApiDocs({
                entitySchema,
                createSchema,
                updateSchema,
            });
            
            assertExists(docs.update.detail.response);
            assertExists((docs.update.detail.response as any)[200]);
        });

        await t.step("createApiDocs delete response includes 200 status", () => {
            const entitySchema = tBox.Object({ id: tBox.Number() });
            const createSchema = tBox.Object({ name: tBox.String() });
            const updateSchema = tBox.Object({ name: tBox.Optional(tBox.String()) });
            
            const docs = createApiDocs({
                entitySchema,
                createSchema,
                updateSchema,
            });
            
            assertExists(docs.delete.detail.response);
            assertExists((docs.delete.detail.response as any)[200]);
        });
    },
});

