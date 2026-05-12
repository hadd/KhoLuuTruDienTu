import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { eq, isNull } from "drizzle-orm";
import { getTestDb, setupTestDatabase, closeTestDb, TEST_OPTS } from "../setup/utils.ts";
import { createBookService, createBookServiceWithMapRecord, createHardDeleteItemService } from "../fixtures/helpers.ts";
import { books, hardDeleteItems } from "../setup/schema.ts";
import { seedBooks } from "../fixtures/seed.ts";

Deno.test.beforeAll(async () => {
    await setupTestDatabase();
});

Deno.test.afterAll(async () => {
    await closeTestDb();
});

Deno.test({
    name: "BaseService - Delete Operations",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookService(db);

        await t.step("Service can soft delete item", async () => {
            const directResult = await db
                .select()
                .from(books)
                .where(isNull(books.deletedAt))
                .limit(1);

            assertExists(directResult[0]);
            const bookId = directResult[0].id;

            const deleteResult = await service.delete(bookId);

            assertEquals(deleteResult.id, bookId);

            const directResultAfterDelete = await db
                .select()
                .from(books)
                .where(eq(books.id, bookId))
                .limit(1);

            assertEquals(directResultAfterDelete.length, 1);
            assertExists(directResultAfterDelete[0].deletedAt);

            const listResult = await service.list({});
            const deletedBookInList = listResult.items.find((item: any) => item.id === bookId);
            assertEquals(deletedBookInList, undefined);
        });

        await t.step("Soft deleted item is not returned in list", async () => {
            const directResult = await db
                .select()
                .from(books)
                .where(isNull(books.deletedAt))
                .limit(1);

            if (directResult.length > 0) {
                const bookId = directResult[0].id;
                await service.delete(bookId);

                const listResult = await service.list({});
                const found = listResult.items.find((item: any) => item.id === bookId);
                assertEquals(found, undefined);
            }
        });

        await t.step("Soft deleted item still exists in database", async () => {
            const directResult = await db
                .select()
                .from(books)
                .where(isNull(books.deletedAt))
                .limit(1);

            if (directResult.length > 0) {
                const bookId = directResult[0].id;
                await service.delete(bookId);

                // Check directly in database (bypassing soft delete filter)
                const dbResult = await db
                    .select()
                    .from(books)
                    .where(eq(books.id, bookId))
                    .limit(1);

                assertEquals(dbResult.length, 1);
                assertExists(dbResult[0].deletedAt);
            }
        });
    },
});

Deno.test({
    name: "BaseService - Delete with Internal Filter",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookService(db);

        await t.step("Service can delete with internalFilterQuery", async () => {
            const [book] = await seedBooks(db, [{ name: "Internal Filter Delete Test", description: null, authorId: null, publisherId: null }]);
            const deleteResult = await service.delete(book.id, {
                internalFilterQuery: () => eq(books.id, book.id),
            });

            assertEquals(deleteResult.id, book.id);

            const dbResult = await db
                .select()
                .from(books)
                .where(eq(books.id, book.id))
                .limit(1);

            assertEquals(dbResult.length, 1);
            assertExists(dbResult[0].deletedAt);
        });

        await t.step("Service throws 404 when internalFilterQuery excludes record", async () => {
            const [book] = await seedBooks(db, [{ name: "Excluded Delete Test", description: null, authorId: null, publisherId: null }]);

            await assertRejects(
                async () => {
                    await service.delete(book.id, {
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
    name: "BaseService - Delete Error Cases",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookService(db);

        await t.step("Service throws 404 for non-existent ID", async () => {
            await assertRejects(
                async () => {
                    await service.delete("ffffffff-ffff-ffff-ffff-ffffffffffff");
                },
                Error,
                "Not Found",
            );
        });

        await t.step("Service throws 400 for invalid ID (empty string)", async () => {
            await assertRejects(
                async () => {
                    await service.delete("" as any);
                },
                Error,
                "Invalid ID",
            );
        });

        await t.step("Service throws 400 for invalid ID (NaN)", async () => {
            await assertRejects(
                async () => {
                    await service.delete(NaN as any);
                },
                Error,
                "Invalid ID",
            );
        });

        await t.step("Service throws 400 for invalid ID (negative)", async () => {
            await assertRejects(
                async () => {
                    await service.delete(-1);
                },
                Error,
                "Invalid ID",
            );
        });

        await t.step("Service throws 404 for already soft-deleted record", async () => {
            const [book] = await seedBooks(db, [{ name: "Already Deleted Test", description: null, authorId: null, publisherId: null }]);
            await service.delete(book.id);

            await assertRejects(
                async () => {
                    await service.delete(book.id);
                },
                Error,
                "Not Found",
            );
        });
    },
});

Deno.test({
    name: "BaseService - Delete with MapRecord",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookServiceWithMapRecord(db);

        await t.step("Service can delete with mapRecord function", async () => {
            const [book] = await seedBooks(db, [{ name: "MapRecord Delete Test", description: null, authorId: null, publisherId: null }]);
            const deleteResult = await service.delete(book.id);

            assertEquals(deleteResult.id, book.id);
            assertEquals((deleteResult as any).mapped, true);
        });
    },
});

Deno.test({
    name: "BaseService - Hard Delete Operations",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createHardDeleteItemService(db);

        await t.step("Service can hard delete item (table without deletedAt)", async () => {
            const timestamp = Date.now();
            const newItem = { name: `Hard Delete Test ${timestamp}`, description: "Test item" };
            const createdItem = await service.create(newItem);

            assertExists(createdItem);
            assertExists(createdItem.id);

            const deleteResult = await service.delete(createdItem.id);
            assertEquals(deleteResult.id, createdItem.id);

            const directResult = await db
                .select()
                .from(hardDeleteItems)
                .where(eq(hardDeleteItems.id, createdItem.id))
                .limit(1);

            assertEquals(directResult.length, 0);
        });

        await t.step("Service throws 404 for non-existent ID in hard delete", async () => {
            await assertRejects(
                async () => {
                    await service.delete("ffffffff-ffff-ffff-ffff-ffffffffffff");
                },
                Error,
                "Not Found",
            );
        });
    },
});

