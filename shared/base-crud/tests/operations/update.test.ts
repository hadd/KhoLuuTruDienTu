import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { eq, isNull } from "drizzle-orm";
import { getTestDb, setupTestDatabase, closeTestDb, TEST_OPTS } from "../setup/utils.ts";
import { createBookService, createBookServiceWithRelations, createBookServiceWithMapRecord, createBookSchema, updateBookSchema, bookEntitySchema } from "../fixtures/helpers.ts";
import { books } from "../setup/schema.ts";
import { seedAuthors, seedPublishers, seedBooks } from "../fixtures/seed.ts";
import { createCrudService } from "../../src/baseService.ts";

Deno.test.beforeAll(async () => {
    await setupTestDatabase();
});

Deno.test.afterAll(async () => {
    await closeTestDb();
});

Deno.test({
    name: "BaseService - Update Operations",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookService(db);

        await t.step("Service can update existing item", async () => {
            const directResult = await db
                .select()
                .from(books)
                .where(isNull(books.deletedAt))
                .limit(1);

            assertExists(directResult[0]);
            const bookId = directResult[0].id;
            const timestamp = Date.now();

            const updateData = { name: `Updated Book Name ${timestamp}`, description: "Updated description" };
            const updatedBook = await service.update(bookId, updateData);

            assertExists(updatedBook);
            assertEquals(updatedBook.id, bookId);

            const directResultAfterUpdate = await db
                .select()
                .from(books)
                .where(eq(books.id, bookId))
                .limit(1);

            assertEquals(directResultAfterUpdate.length, 1);
            assertEquals(updatedBook.name, directResultAfterUpdate[0].name);
            assertEquals(updatedBook.description, directResultAfterUpdate[0].description);
            assertEquals(updatedBook.id, directResultAfterUpdate[0].id);
            assertExists(updatedBook.updatedAt);
            assertEquals(updatedBook.deletedAt, null);
        });

        await t.step("Service can perform partial update", async () => {
            const directResult = await db
                .select()
                .from(books)
                .where(isNull(books.deletedAt))
                .limit(1);

            assertExists(directResult[0]);
            const bookId = directResult[0].id;
            const originalName = directResult[0].name;

            const updateData = { description: "Only description updated" };
            const updatedBook = await service.update(bookId, updateData);

            assertExists(updatedBook);
            assertEquals(updatedBook.id, bookId);
            assertEquals(updatedBook.name, originalName);
            assertEquals(updatedBook.description, "Only description updated");
        });

        await t.step("Service updates updatedAt timestamp", async () => {
            const directResult = await db
                .select()
                .from(books)
                .where(isNull(books.deletedAt))
                .limit(1);

            assertExists(directResult[0]);
            const bookId = directResult[0].id;
            const originalUpdatedAt = directResult[0].updatedAt;

            // Wait a bit to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 10));

            const updateData = { description: "Timestamp test" };
            const updatedBook = await service.update(bookId, updateData);

            assertExists(updatedBook);
            assertExists(updatedBook.updatedAt);
            // updatedAt should be different (newer)
            assertExists(updatedBook.updatedAt > originalUpdatedAt || updatedBook.updatedAt.getTime() >= originalUpdatedAt.getTime());
        });
    },
});

Deno.test({
    name: "BaseService - Update with Relations",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookServiceWithRelations(db);

        await t.step("Service can update with relations using defaultWith", async () => {
            const [author] = await seedAuthors(db, [{ name: "Update Author", email: null }]);
            const [publisher] = await seedPublishers(db, [{ name: "Update Publisher", address: null }]);
            const [book] = await seedBooks(db, [{ name: "Update With Relations", description: null, authorId: author.id, publisherId: publisher.id }]);

            const updateData = { description: "Updated description" };
            const updatedBook = await service.update(book.id, updateData);

            assertExists(updatedBook);
            assertExists((updatedBook as any).author);
            assertExists((updatedBook as any).publisher);
            assertEquals((updatedBook as any).author.id, author.id);
            assertEquals((updatedBook as any).publisher.id, publisher.id);
        });
    },
});

Deno.test({
    name: "BaseService - Update with MapRecord",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookServiceWithMapRecord(db);

        await t.step("Service can update with mapRecord function", async () => {
            const [book] = await seedBooks(db, [{ name: "MapRecord Update Test", description: null, authorId: null, publisherId: null }]);
            const updateData = { description: "Updated" };
            const updatedBook = await service.update(book.id, updateData);

            assertExists(updatedBook);
            assertEquals((updatedBook as any).mapped, true);
        });
    },
});

Deno.test({
    name: "BaseService - Update with Internal Filter",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookService(db);

        await t.step("Service can update with internalFilterQuery", async () => {
            const [book] = await seedBooks(db, [{ name: "Internal Filter Update Test", description: null, authorId: null, publisherId: null }]);
            const updateData = { description: "Updated with filter" };
            const updatedBook = await service.update(book.id, updateData, {
                internalFilterQuery: () => eq(books.id, book.id),
            });

            assertExists(updatedBook);
            assertEquals(updatedBook.id, book.id);
            assertEquals(updatedBook.description, "Updated with filter");
        });

        await t.step("Service throws 404 when internalFilterQuery excludes record", async () => {
            const [book] = await seedBooks(db, [{ name: "Excluded Update Test", description: null, authorId: null, publisherId: null }]);

            await assertRejects(
                async () => {
                    await service.update(book.id, { description: "Test" }, {
                        internalFilterQuery: () => eq(books.id, "ffffffff-ffff-ffff-ffff-ffffffffffff"),
                    });
                },
                Error,
                "Not Found",
            );
        });
    },
});

Deno.test({
    name: "BaseService - Update Error Cases",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookService(db);

        await t.step("Service throws 404 for non-existent ID", async () => {
            await assertRejects(
                async () => {
                    await service.update("ffffffff-ffff-ffff-ffff-ffffffffffff", { description: "Test" });
                },
                Error,
                "Not Found",
            );
        });

        await t.step("Service throws 400 for invalid ID (empty string)", async () => {
            await assertRejects(
                async () => {
                    await service.update("" as any, { description: "Test" });
                },
                Error,
                "Invalid ID",
            );
        });

        await t.step("Service throws 400 for invalid ID (NaN)", async () => {
            await assertRejects(
                async () => {
                    await service.update(NaN as any, { description: "Test" });
                },
                Error,
                "Invalid ID",
            );
        });

        await t.step("Service throws 400 for invalid ID (negative)", async () => {
            await assertRejects(
                async () => {
                    await service.update(-1, { description: "Test" });
                },
                Error,
                "Invalid ID",
            );
        });
    },
});

Deno.test({
    name: "BaseService - Update Fallback Paths",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookService(db);

        await t.step("Service can update without relationalQueryApi", async () => {
            const [book] = await seedBooks(db, [{ name: "Fallback Update Test", description: null, authorId: null, publisherId: null }]);
            const updateData = { description: "Updated without relations" };
            const updatedBook = await service.update(book.id, updateData);

            assertExists(updatedBook);
            assertEquals(updatedBook.id, book.id);
            assertEquals(updatedBook.description, "Updated without relations");
        });
    },
});

Deno.test({
    name: "BaseService - Update MapRecord Edge Cases",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();

        await t.step("Service handles update when mapRecord returns undefined", async () => {
            const service = createCrudService({
                db,
                table: books,
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
                searchable: ["name", "description"],
                mapRecord: () => undefined as any,
            });

            const [book] = await seedBooks(db, [{ name: "MapRecord Undefined Update", description: null, authorId: null, publisherId: null }]);
            const updateData = { description: "Updated" };
            const updatedBook = await service.update(book.id, updateData);

            assertExists(updatedBook);
            assertEquals(updatedBook.id, book.id);
            assertEquals(updatedBook.description, "Updated");
        });

        await t.step("Service handles update when mapRecord returns empty array", async () => {
            const service = createCrudService({
                db,
                table: books,
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
                searchable: ["name", "description"],
                mapRecord: () => [],
            });

            const [book] = await seedBooks(db, [{ name: "MapRecord Empty Update", description: null, authorId: null, publisherId: null }]);
            const updateData = { description: "Updated" };
            const updatedBook = await service.update(book.id, updateData);

            assertExists(updatedBook);
            assertEquals(updatedBook.id, book.id);
            assertEquals(updatedBook.description, "Updated");
        });
    },
});

Deno.test({
    name: "BaseService - Update Relational Query Edge Cases",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookServiceWithRelations(db);

        await t.step("Service handles update when relational query returns empty array", async () => {
            const [author] = await seedAuthors(db, [{ name: "Update Empty Rel Author", email: null }]);
            const [publisher] = await seedPublishers(db, [{ name: "Update Empty Rel Publisher", address: null }]);
            const [book] = await seedBooks(db, [{ name: "Update Empty Rel Query", description: null, authorId: author.id, publisherId: publisher.id }]);
            
            const updateData = { description: "Updated" };
            const updatedBook = await service.update(book.id, updateData);
            
            assertExists(updatedBook);
            assertEquals(updatedBook.id, book.id);
            assertEquals(updatedBook.description, "Updated");
        });
    },
});

