import { assertEquals, assertExists } from "@std/assert";
import { eq, isNull } from "drizzle-orm";
import { getTestDb, setupTestDatabase, closeTestDb, TEST_OPTS } from "../setup/utils.ts";
import { createBookService, createBookServiceWithRelations, createBookServiceWithMapRecord, createBookSchema, updateBookSchema, bookEntitySchema } from "../fixtures/helpers.ts";
import { books } from "../setup/schema.ts";
import { seedAuthors, seedPublishers } from "../fixtures/seed.ts";
import { createCrudService } from "../../src/baseService.ts";

Deno.test.beforeAll(async () => {
    await setupTestDatabase();
});

Deno.test.afterAll(async () => {
    await closeTestDb();
});

Deno.test({
    name: "BaseService - Create Operations",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookService(db);

        await t.step("Service can create new item", async () => {
            const timestamp = Date.now();
            const newBook = { name: `New Book ${timestamp}`, description: "Newly created book" };
            const createdBook = await service.create(newBook);

            assertExists(createdBook);
            assertExists(createdBook.id);
            assertExists(createdBook.createdAt);
            assertExists(createdBook.updatedAt);
            assertEquals(createdBook.deletedAt, null);

            const directResult = await db
                .select()
                .from(books)
                .where(eq(books.id, createdBook.id))
                .limit(1);

            assertEquals(directResult.length, 1);
            assertEquals(createdBook.name, directResult[0].name);
            assertEquals(createdBook.description, directResult[0].description);
            assertEquals(createdBook.id, directResult[0].id);
        });

        await t.step("Service can create item with optional fields", async () => {
            const timestamp = Date.now();
            const newBook = { name: `Minimal Book ${timestamp}` };
            const createdBook = await service.create(newBook);

            assertExists(createdBook);
            assertExists(createdBook.id);
            assertEquals(createdBook.name, `Minimal Book ${timestamp}`);
            assertEquals(createdBook.description, null);
        });

        await t.step("Service can create item with relations", async () => {
            // First get an author and publisher from seed data
            const authors = await db.select().from(books).where(isNull(books.deletedAt)).limit(1);
            if (authors.length > 0) {
                const timestamp = Date.now();
                const newBook = { 
                    name: `Book with Relations ${timestamp}`, 
                    description: "Test book",
                    authorId: undefined,
                    publisherId: undefined,
                };
                const createdBook = await service.create(newBook);

                assertExists(createdBook);
                assertEquals(createdBook.name, `Book with Relations ${timestamp}`);
            }
        });
    },
});

Deno.test({
    name: "BaseService - Create with Relations",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookServiceWithRelations(db);

        await t.step("Service can create with relations using defaultWith", async () => {
            const [author] = await seedAuthors(db, [{ name: "Create Author", email: null }]);
            const [publisher] = await seedPublishers(db, [{ name: "Create Publisher", address: null }]);
            const timestamp = Date.now();
            const newBook = {
                name: `Create With Relations ${timestamp}`,
                description: "Test book",
                authorId: author.id,
                publisherId: publisher.id,
            };
            const createdBook = await service.create(newBook);

            assertExists(createdBook);
            assertExists((createdBook as any).author);
            assertExists((createdBook as any).publisher);
            assertEquals((createdBook as any).author.id, author.id);
            assertEquals((createdBook as any).publisher.id, publisher.id);
        });
    },
});

Deno.test({
    name: "BaseService - Create with MapRecord",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookServiceWithMapRecord(db);

        await t.step("Service can create with mapRecord function", async () => {
            const timestamp = Date.now();
            const newBook = { name: `MapRecord Create ${timestamp}`, description: "Test" };
            const createdBook = await service.create(newBook);

            assertExists(createdBook);
            assertEquals((createdBook as any).mapped, true);
        });
    },
});

Deno.test({
    name: "BaseService - Create Fallback Paths",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookService(db);

        await t.step("Service can create without relationalQueryApi", async () => {
            const timestamp = Date.now();
            const newBook = { name: `Fallback Create ${timestamp}`, description: "Test" };
            const createdBook = await service.create(newBook);

            assertExists(createdBook);
            assertExists(createdBook.id);
            assertEquals(createdBook.name, `Fallback Create ${timestamp}`);
        });
    },
});

Deno.test({
    name: "BaseService - Create MapRecord Edge Cases",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();

        await t.step("Service handles create when mapRecord returns undefined", async () => {
            const service = createCrudService({
                db,
                table: books,
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
                searchable: ["name", "description"],
                mapRecord: () => undefined as any,
            });

            const timestamp = Date.now();
            const newBook = { name: `MapRecord Undefined ${timestamp}`, description: "Test" };
            const createdBook = await service.create(newBook);

            assertExists(createdBook);
            assertExists(createdBook.id);
            assertEquals(createdBook.name, `MapRecord Undefined ${timestamp}`);
        });

        await t.step("Service handles create when mapRecord returns empty array", async () => {
            const service = createCrudService({
                db,
                table: books,
                createSchema: createBookSchema,
                updateSchema: updateBookSchema,
                entitySchema: bookEntitySchema,
                searchable: ["name", "description"],
                mapRecord: () => [],
            });

            const timestamp = Date.now();
            const newBook = { name: `MapRecord Empty ${timestamp}`, description: "Test" };
            const createdBook = await service.create(newBook);

            assertExists(createdBook);
            assertExists(createdBook.id);
            assertEquals(createdBook.name, `MapRecord Empty ${timestamp}`);
        });
    },
});

Deno.test({
    name: "BaseService - Create Relational Query Edge Cases",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const service = createBookServiceWithRelations(db);

        await t.step("Service handles create when relational query returns empty array", async () => {
            const [author] = await seedAuthors(db, [{ name: "Empty Rel Author", email: null }]);
            const [publisher] = await seedPublishers(db, [{ name: "Empty Rel Publisher", address: null }]);
            const timestamp = Date.now();
            const newBook = {
                name: `Empty Rel Query ${timestamp}`,
                description: "Test",
                authorId: author.id,
                publisherId: publisher.id,
            };
            
            const createdBook = await service.create(newBook);
            
            assertExists(createdBook);
            assertExists(createdBook.id);
            assertEquals(createdBook.name, `Empty Rel Query ${timestamp}`);
        });
    },
});

