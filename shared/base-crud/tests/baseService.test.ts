import { assertEquals, assertExists } from "@std/assert";
import { t } from "elysia";
import { eq, isNull } from "drizzle-orm";
import { getTestDb, setupTestDatabase, closeTestDb, TEST_OPTS } from "./setup/utils.ts";
import { createCrudService } from "../src/baseService.ts";
import { books, authors } from "./setup/schema.ts";
import { seedBooks, seedAuthors } from "./fixtures/seed.ts";

Deno.test.beforeAll(async () => {
    await setupTestDatabase();
});

Deno.test.afterAll(async () => {
    await closeTestDb();
});

Deno.test({
    name: "BaseService - Service Creation",
    ...TEST_OPTS,
    fn: async (testCtx) => {
        const db = getTestDb();

        const createBookSchema = t.Object({
            name: t.String({ minLength: 1 }),
            description: t.Optional(t.String()),
        });

        const updateBookSchema = t.Object({
            name: t.Optional(t.String({ minLength: 1 })),
            description: t.Optional(t.String()),
        });

        const bookEntitySchema = t.Object({
            id: t.Number(),
            name: t.String(),
            description: t.Union([t.String(), t.Null()]),
            createdAt: t.Any(),
            updatedAt: t.Any(),
            deletedAt: t.Union([t.Any(), t.Null()]),
        });

        await testCtx.step("Service can be created with auto-inferred queryKey", async () => {
            const service = createCrudService({
                db,
                table: books,
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
                searchable: ["name", "description"],
            });

            assertExists(service);
        });

        await testCtx.step("Service can be created with manual relationTables", async () => {
            const service = createCrudService({
                db,
                table: books,
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
                relationTables: {
                    author: authors,
                },
                searchable: ["name"],
            });

            assertExists(service);
        });

        await testCtx.step("Service can be created with defaultWith", async () => {
            const service = createCrudService({
                db,
                table: books,
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
                relationTables: {
                    author: authors,
                },
                defaultWith: {
                    author: true,
                },
                searchable: ["name"],
            });

            assertExists(service);
        });

        await testCtx.step("Service can be created with mapRecord", async () => {
            const mapRecord = async (rows: unknown[]) => {
                return rows.map((row: any) => ({
                    ...row,
                    mapped: true,
                }));
            };

            const service = createCrudService({
                db,
                table: books,
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
                mapRecord,
                searchable: ["name"],
            });

            assertExists(service);

            const book = await db.query.books.findFirst({
                where: isNull(books.deletedAt),
            });
            const result = await service.get(book?.id ?? "");

            assertExists(result);
            assertEquals((result as any).mapped, true);
        });

        await testCtx.step("Service can be created with restrictServiceQuery", async () => {
            const [book1] = await seedBooks(db, [{ name: "Restrict Book 1", description: null, authorId: null, publisherId: null }]);
            await seedBooks(db, [{ name: "Restrict Book 2", description: null, authorId: null, publisherId: null }]);

            const service = createCrudService({
                db,
                table: books,
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
                restrictServiceQuery: () => eq(books.id, book1.id),
                searchable: ["name"],
            });

            assertExists(service);

            const result = await service.list({});
            assertEquals(result.items.length, 1);
            assertEquals((result.items[0] as any).id, book1.id);
        });
    },
});

Deno.test({
    name: "BaseService - Getter Methods",
    ...TEST_OPTS,
    fn: async (testCtx) => {
        const db = getTestDb();

        const createBookSchema = t.Object({
            name: t.String({ minLength: 1 }),
        });

        const updateBookSchema = t.Object({
            name: t.Optional(t.String({ minLength: 1 })),
        });

        const bookEntitySchema = t.Object({
            id: t.Number(),
            name: t.String(),
        });

        const metadata = {
            tags: ["books"],
            description: "Book operations",
        };

        const service = createCrudService({
            db,
            table: books,
            createSchema: createBookSchema,
            updateSchema: updateBookSchema,
            entitySchema: bookEntitySchema,
            metadata,
            searchable: ["name"],
        });

        await testCtx.step("getCreateSchema returns correct schema", async () => {
            const schema = service.getCreateSchema();
            assertEquals(schema, createBookSchema);
        });

        await testCtx.step("getUpdateSchema returns correct schema", async () => {
            const schema = service.getUpdateSchema();
            assertEquals(schema, updateBookSchema);
        });

        await testCtx.step("getMetadata returns correct metadata", async () => {
            const meta = service.getMetadata();
            assertEquals(meta, metadata);
        });

        await testCtx.step("getListResponseSchema returns schema", async () => {
            const schema = service.getListResponseSchema();
            assertExists(schema);
        });

        await testCtx.step("getRecordResponseSchema returns schema", async () => {
            const schema = service.getRecordResponseSchema();
            assertExists(schema);
        });

        await testCtx.step("getDocs returns documentation without routeMetadata", async () => {
            const docs = service.getDocs();
            assertExists(docs);
            assertExists(docs.tags);
            assertExists(docs.list);
            assertExists(docs.get);
            assertExists(docs.create);
            assertExists(docs.update);
            assertExists(docs.delete);
        });

        await testCtx.step("getDocs returns documentation with routeMetadata", async () => {
            const docs = service.getDocs({ tags: ["custom-tag"] });
            assertExists(docs);
            assertEquals(docs.tags, ["custom-tag"]);
        });
    },
});

Deno.test({
    name: "BaseService - Service with Inferred Relations",
    ...TEST_OPTS,
    fn: async (testCtx) => {
        const db = getTestDb();

        const createBookSchema = t.Object({
            name: t.String({ minLength: 1 }),
            authorId: t.Optional(t.Number()),
        });

        const updateBookSchema = t.Object({
            name: t.Optional(t.String({ minLength: 1 })),
            authorId: t.Optional(t.Number()),
        });

        const bookEntitySchema = t.Object({
            id: t.Number(),
            name: t.String(),
            authorId: t.Union([t.Number(), t.Null()]),
        });

        await testCtx.step("Service can infer relations when relationTables is empty", async () => {
            const service = createCrudService({
                db,
                table: books,
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
                relationTables: {},
                searchable: ["name"],
            });

            assertExists(service);
        });

        await testCtx.step("Service merges inferred and manual relations", async () => {
            const [author] = await seedAuthors(db, [{ name: "Merged Author", email: null }]);
            const service = createCrudService({
                db,
                table: books,
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
                relationTables: {
                    author: authors,
                },
                relationForeignKeys: {
                    author: books.authorId,
                },
                defaultWith: {
                    author: true,
                },
                searchable: ["name"],
            });

            assertExists(service);

            const [book] = await seedBooks(db, [{ name: "Merged Book", description: null, authorId: author.id, publisherId: null }]);
            const result = await service.get(book.id);

            assertExists(result);
            assertExists((result as any).author);
        });

        await testCtx.step("Service skips inference when relationTables is provided", async () => {
            const service = createCrudService({
                db,
                table: books,
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
                relationTables: {
                    author: authors,
                },
                searchable: ["name"],
            });

            assertExists(service);
        });
    },
});

Deno.test({
    name: "BaseService - Service Creation Edge Cases",
    ...TEST_OPTS,
    fn: async (testCtx) => {
        const db = getTestDb();

        const createBookSchema = t.Object({
            name: t.String({ minLength: 1 }),
        });

        const updateBookSchema = t.Object({
            name: t.Optional(t.String({ minLength: 1 })),
        });

        const bookEntitySchema = t.Object({
            id: t.Number(),
            name: t.String(),
        });

        await testCtx.step("Service can be created when db.query is undefined", () => {
            const dbWithoutQuery = { ...db } as any;
            delete dbWithoutQuery.query;

            const service = createCrudService({
                db: dbWithoutQuery,
                table: books,
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
                searchable: ["name"],
            });

            assertExists(service);
        });

        await testCtx.step("Service can be created with empty searchable array", () => {
            const service = createCrudService({
                db,
                table: books,
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
                searchable: [],
            });

            assertExists(service);
        });

        await testCtx.step("Service can be created without searchable", () => {
            const service = createCrudService({
                db,
                table: books,
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
            });

            assertExists(service);
        });

        await testCtx.step("Service can be created without metadata", () => {
            const service = createCrudService({
                db,
                table: books,
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
            });

            assertExists(service);
            assertEquals(service.getMetadata(), undefined);
        });

        await testCtx.step("Service can be created without defaultWith", () => {
            const service = createCrudService({
                db,
                table: books,
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
            });

            assertExists(service);
        });

        await testCtx.step("Service can be created without mapRecord", () => {
            const service = createCrudService({
                db,
                table: books,
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
            });

            assertExists(service);
        });

        await testCtx.step("Service can be created without restrictServiceQuery", () => {
            const service = createCrudService({
                db,
                table: books,
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
            });

            assertExists(service);
        });

        await testCtx.step("Service auto-detects array columns during initialization", () => {
            const service = createCrudService({
                db,
                table: books,
                searchable: ["name"],
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
            });

            assertExists(service);
        });

        await testCtx.step("Service handles searchable fields with array columns", () => {
            const service = createCrudService({
                db,
                table: books,

                searchable: ["name"],
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
            });

            assertExists(service);
        });
    },
});

Deno.test({
    name: "BaseService - Getter Methods Edge Cases",
    ...TEST_OPTS,
    fn: async (testCtx) => {
        const db = getTestDb();

        const createBookSchema = t.Object({
            name: t.String({ minLength: 1 }),
        });

        const updateBookSchema = t.Object({
            name: t.Optional(t.String({ minLength: 1 })),
        });

        const bookEntitySchema = t.Object({
            id: t.Number(),
            name: t.String(),
        });

        await testCtx.step("getCreateSchema returns undefined when not provided", () => {
            const serviceWithoutCreate = createCrudService({
                db,
                table: books,
                createSchema: undefined,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
            });

            assertEquals(serviceWithoutCreate.getCreateSchema(), undefined);
        });

        await testCtx.step("getUpdateSchema returns undefined when not provided", () => {
            const serviceWithoutUpdate = createCrudService({
                db,
                table: books,
                createSchema: createBookSchema,
                updateSchema: undefined,
                entitySchema: bookEntitySchema,
            });

            assertEquals(serviceWithoutUpdate.getUpdateSchema(), undefined);
        });

        await testCtx.step("getListResponseSchema works with undefined entitySchema", () => {
            const serviceWithoutEntity = createCrudService({
                db,
                table: books,
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: undefined,
            });

            const schema = serviceWithoutEntity.getListResponseSchema();
            assertExists(schema);
        });

        await testCtx.step("getRecordResponseSchema works with undefined entitySchema", () => {
            const serviceWithoutEntity = createCrudService({
                db,
                table: books,
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: undefined,
            });

            const schema = serviceWithoutEntity.getRecordResponseSchema();
            assertExists(schema);
        });

        await testCtx.step("getDocs works without routeMetadata and metadata", () => {
            const serviceWithoutMetadata = createCrudService({
                db,
                table: books,
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
            });

            const docs = serviceWithoutMetadata.getDocs();
            assertExists(docs);
            assertEquals(docs.tags, []);
        });
    },
});

