import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDatabase, closeTestDb, TEST_OPTS } from "../setup/utils.ts";
import { createBookService, createBookServiceWithRelations, createBookServiceWithRestrictQuery, createBookServiceWithMapRecordForGet } from "../fixtures/helpers.ts";
import { books } from "../setup/schema.ts";
import { seedBooks, seedAuthors, seedPublishers } from "../fixtures/seed.ts";

Deno.test.beforeAll(async () => {
    await setupTestDatabase();
});

Deno.test.afterAll(async () => {
    await closeTestDb();
});

Deno.test({
    name: "BaseService - Get Operations",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookService(db);

        await t.step("Service can get existing item", async () => {
            const [book] = await seedBooks(db, [{ name: "Get Test Book", description: "Test", authorId: null, publisherId: null }]);

            const result = await service.get(book.id);

            assertExists(result);
            assertEquals(result.id, book.id);
            assertEquals(result.name, book.name);
        });

        await t.step("Service throws 404 for non-existent ID", async () => {
            await assertRejects(
                async () => {
                    await service.get("ffffffff-ffff-ffff-ffff-ffffffffffff");
                },
                Error,
                "not found",
            );
        });

        await t.step("Service throws 400 for invalid ID (empty string)", async () => {
            await assertRejects(
                async () => {
                    await service.get("" as any);
                },
                Error,
                "Invalid ID",
            );
        });

        await t.step("Service throws 400 for invalid ID (NaN)", async () => {
            await assertRejects(
                async () => {
                    await service.get(NaN as any);
                },
                Error,
                "Invalid ID",
            );
        });

        await t.step("Service throws 400 for invalid ID (negative)", async () => {
            await assertRejects(
                async () => {
                    await service.get("-1" as any);
                },
                Error,
                "Invalid ID",
            );
        });

        await t.step("Service filters out soft-deleted records", async () => {
            const [book] = await seedBooks(db, [{ name: "To Delete Book", description: null, authorId: null, publisherId: null }]);
            await db.update(books).set({ deletedAt: new Date() }).where(eq(books.id, book.id));

            await assertRejects(
                async () => {
                    await service.get(book.id);
                },
                Error,
                "not found",
            );
        });
    },
});

Deno.test({
    name: "BaseService - Get with Relations",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookServiceWithRelations(db);

        await t.step("Service can get with relations using defaultWith", async () => {
            const [author] = await seedAuthors(db, [{ name: "Get Author", email: null }]);
            const [publisher] = await seedPublishers(db, [{ name: "Get Publisher", address: null }]);
            const [book] = await seedBooks(db, [{ name: "Get With Relations", description: null, authorId: author.id, publisherId: publisher.id }]);

            const result = await service.get(book.id);

            assertExists(result);
            assertExists((result as any).author);
            assertExists((result as any).publisher);
            assertEquals((result as any).author.id, author.id);
            assertEquals((result as any).publisher.id, publisher.id);
        });

        await t.step("Service can get with relations using with: true", async () => {
            const [author] = await seedAuthors(db, [{ name: "Get Author 2", email: null }]);
            const [book] = await seedBooks(db, [{ name: "Get With True", description: null, authorId: author.id, publisherId: null }]);

            const result = await service.get(book.id, { with: true });

            assertExists(result);
            assertExists((result as any).author);
        });

        await t.step("Service can get with relations using with: object", async () => {
            const [author] = await seedAuthors(db, [{ name: "Get Author 3", email: null }]);
            const [book] = await seedBooks(db, [{ name: "Get With Object", description: null, authorId: author.id, publisherId: null }]);

            const result = await service.get(book.id, { with: { author: true } });

            assertExists(result);
            assertExists((result as any).author);
        });

        await t.step("Service can get with merged with object", async () => {
            const [author] = await seedAuthors(db, [{ name: "Get Author 4", email: null }]);
            const [publisher] = await seedPublishers(db, [{ name: "Get Publisher 2", address: null }]);
            await seedBooks(db, [{ name: "Get Merged", description: null, authorId: author.id, publisherId: publisher.id }]);
            const [book] = await seedBooks(db, [{ name: "Get Merged 2", description: null, authorId: author.id, publisherId: publisher.id }]);

            const result = await service.get(book.id, { with: { publisher: true } });

            assertExists(result);
            assertExists((result as any).author);
            assertExists((result as any).publisher);
        });
    },
});

Deno.test({
    name: "BaseService - Get with Filters",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookService(db);

        await t.step("Service can get with internalFilterQuery", async () => {
            const [book1] = await seedBooks(db, [{ name: "Filter Book 1", description: null, authorId: null, publisherId: null }]);

            const result = await service.get(book1.id, {
                internalFilterQuery: () => eq(books.id, book1.id),
            });

            assertExists(result);
            assertEquals(result.id, book1.id);
        });

        await t.step("Service throws 404 when internalFilterQuery excludes record", async () => {
            const [book] = await seedBooks(db, [{ name: "Excluded Book", description: null, authorId: null, publisherId: null }]);

            await assertRejects(
                async () => {
                    await service.get(book.id, {
                        internalFilterQuery: () => eq(books.id, "ffffffff-ffff-ffff-ffff-ffffffffffff"),
                    });
                },
                Error,
                "not found",
            );
        });

        await t.step("Service can get with internalFilterQuery returning undefined", async () => {
            const [book] = await seedBooks(db, [{ name: "Undefined Filter Book", description: null, authorId: null, publisherId: null }]);

            const result = await service.get(book.id, {
                internalFilterQuery: () => undefined,
            });

            assertExists(result);
            assertEquals(result.id, book.id);
        });
    },
});

Deno.test({
    name: "BaseService - Get without Relations",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookService(db);

        await t.step("Service can get without relationalQueryApi", async () => {
            const [book] = await seedBooks(db, [{ name: "No Relations Book", description: "Test", authorId: null, publisherId: null }]);

            const result = await service.get(book.id);

            assertExists(result);
            assertEquals(result.id, book.id);
            assertEquals((result as any).author, undefined);
        });
    },
});

Deno.test({
    name: "BaseService - Get with RestrictServiceQuery",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookServiceWithRestrictQuery(db);

        await t.step("Service can get with restrictServiceQuery", async () => {
            const [book] = await seedBooks(db, [{ name: "Restrict Query Book", description: "Test", authorId: null, publisherId: null }]);

            const result = await service.get(book.id);

            assertExists(result);
            assertEquals(result.id, book.id);
        });
    },
});

Deno.test({
    name: "BaseService - Get with MapRecord",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookServiceWithMapRecordForGet(db);

        await t.step("Service can get with mapRecord function", async () => {
            const [book] = await seedBooks(db, [{ name: "MapRecord Get Book", description: "Test", authorId: null, publisherId: null }]);

            const result = await service.get(book.id);

            assertExists(result);
            assertEquals(result.id, book.id);
            assertEquals((result as any).mapped, true);
        });
    },
});

Deno.test({
    name: "BaseService - Get with Nested With Object",
    ...TEST_OPTS,
    fn: async (t) => {  
        const db = getTestDb();
        const service = createBookServiceWithRelations(db);

        await t.step("Service can get with nested with object", async () => {
            const [author] = await seedAuthors(db, [{ name: "Nested With Author", email: null }]);
            const [publisher] = await seedPublishers(db, [{ name: "Nested With Publisher", address: null }]);
            const [book] = await seedBooks(db, [{ name: "Nested With Book", description: null, authorId: author.id, publisherId: publisher.id }]);

            const result = await service.get(book.id, {
                with: {
                    author: true
                },
            });

            assertExists(result);
            assertExists((result as any).author);
        });
    },
});

Deno.test({
    name: "BaseService - Get with With Option Edge Cases",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookServiceWithRelations(db);

        await t.step("Service can get with with: false", async () => {
            const [author] = await seedAuthors(db, [{ name: "With False Author", email: null }]);
            const [book] = await seedBooks(db, [{ name: "With False Book", description: null, authorId: author.id, publisherId: null }]);

            const result = await service.get(book.id, { with: false });

            assertExists(result);
            assertEquals((result as any).author, undefined);
        });

        await t.step("Service can get with with object without 'with' property", async () => {
            const [author] = await seedAuthors(db, [{ name: "Simple With Author", email: null }]);
            const [book] = await seedBooks(db, [{ name: "Simple With Book", description: null, authorId: author.id, publisherId: null }]);

            const result = await service.get(book.id, {
                with: {
                    author: {},
                },
            });

            assertExists(result);
            assertExists((result as any).author);
        });

        await t.step("Service can get with with object containing false values", async () => {
            const [author] = await seedAuthors(db, [{ name: "False With Author", email: null }]);
            const [publisher] = await seedPublishers(db, [{ name: "False With Publisher", address: null }]);
            const [book] = await seedBooks(db, [{ name: "False With Book", description: null, authorId: author.id, publisherId: publisher.id }]);

            const result = await service.get(book.id, {
                with: {
                    author: true,
                    publisher: false,
                },
            });

            assertExists(result);
            assertExists((result as any).author);
            assertEquals((result as any).publisher, undefined);
        });
    },
});

Deno.test({
    name: "BaseService - Get Fallback Paths",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookService(db);

        await t.step("Service can get without relationalQueryApi", async () => {
            const [book] = await seedBooks(db, [{ name: "Fallback Get Book", description: "Test", authorId: null, publisherId: null }]);

            const result = await service.get(book.id);

            assertExists(result);
            assertEquals(result.id, book.id);
            assertEquals((result as any).author, undefined);
        });

        await t.step("Service can get with undefined with option", async () => {
            const [book] = await seedBooks(db, [{ name: "Undefined With Book", description: "Test", authorId: null, publisherId: null }]);

            const result = await service.get(book.id, { with: undefined });

            assertExists(result);
            assertEquals(result.id, book.id);
        });
    },
});

Deno.test({
    name: "BaseService - Get Nested With Object Merging",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookServiceWithRelations(db);

        await t.step("Service can get with nested with object that has 'with' property", async () => {
            const [author] = await seedAuthors(db, [{ name: "Nested With Merge Author", email: null }]);
            const [publisher] = await seedPublishers(db, [{ name: "Nested With Merge Publisher", address: null }]);
            const [book] = await seedBooks(db, [{ name: "Nested With Merge Book", description: null, authorId: author.id, publisherId: publisher.id }]);

            const result = await service.get(book.id, {
                with: {
                    author: true,
                },
            });

            assertExists(result);
            assertExists((result as any).author);
        });

        await t.step("Service can get with nested with object merging existing defaultWith", async () => {
            const [author] = await seedAuthors(db, [{ name: "Merge With Author", email: null }]);
            const [publisher] = await seedPublishers(db, [{ name: "Merge With Publisher", address: null }]);
            const [book] = await seedBooks(db, [{ name: "Merge With Book", description: null, authorId: author.id, publisherId: publisher.id }]);

            const result = await service.get(book.id, {
                with: {
                    author: true,
                    publisher: true,
                },
            });

            assertExists(result);
            assertExists((result as any).author);
            assertExists((result as any).publisher);
        });
    },
});

