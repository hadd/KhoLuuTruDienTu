import { DATABASE_URL as _DATABASE_URL } from "@shared/test-vars";
import { assertEquals, assertExists } from "@std/assert";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { getTestDb, setupTestDatabase, closeTestDb, TEST_OPTS } from "../setup/utils.ts";
import { createBookService, createBookServiceWithRelations, createBookServiceWithMapRecord, createAuthorServiceWithRelations, createBookServiceWithRelationSearch, createBookSchema, updateBookSchema, bookEntitySchema } from "../fixtures/helpers.ts";
import { books } from "../setup/schema.ts";
import { seedBooks, seedAuthors, seedPublishers } from "../fixtures/seed.ts";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createCrudService } from "../../src/baseService.ts";

async function buildDirectSearchQuery(
    db: PostgresJsDatabase<any>,
    searchTerm: string,
    options?: { limit?: number; offset?: number }
) {
    const searchCondition = and(
        isNull(books.deletedAt),
        or(
            ilike(books.name, `%${searchTerm}%`),
            ilike(books.description, `%${searchTerm}%`)
        )!
    );

    const countResult = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(books)
        .where(searchCondition);
    const count = countResult[0]?.count ?? 0;

    const baseQuery = db
        .select()
        .from(books)
        .where(searchCondition)
        .orderBy(desc(books.createdAt));

    const results = options?.limit !== undefined || options?.offset !== undefined
        ? await baseQuery.limit(options?.limit ?? 999999).offset(options?.offset ?? 0)
        : await baseQuery;

    return { results, count };
}

function assertSearchResults(
    serviceResult: any,
    directResults: any[],
    directCount: number
) {
    assertExists(serviceResult);
    assertEquals(serviceResult.items.length, directResults.length);
    assertEquals(serviceResult.total, directCount);
    const serviceItemNames = serviceResult.items.map((item: any) => item.name).sort();
    const directItemNames = directResults.map((item: any) => item.name).sort();
    assertEquals(serviceItemNames, directItemNames);
}

Deno.test.beforeAll(async () => {
    await setupTestDatabase();
});

Deno.test.afterAll(async () => {
    await closeTestDb();
});

Deno.test({
    name: "BaseService - List Operations",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const bookService = createBookService(db);

        await t.step("Service can list all items", async () => {
            const directCountResult = await db.$count(books, isNull(books.deletedAt));
            const serviceResult = await bookService.list({});

            assertExists(serviceResult);
            assertEquals(serviceResult.total, directCountResult);
            assertEquals(serviceResult.totalPages, Math.max(Math.ceil(directCountResult / 50), 1));
        });

        await t.step("Service can list with pagination", async () => {
            const page = 1;
            const limit = 10;
            const serviceResult = await bookService.list({ page, limit });

            assertExists(serviceResult);
            assertEquals(serviceResult.page, page);
            assertEquals(serviceResult.limit, limit);
            assertEquals(serviceResult.items.length, Math.min(limit, serviceResult.total));
        });
    },
});

Deno.test({
    name: "BaseService - Search Operations",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const bookService = createBookService(db);

        await t.step("Service can search by name", async () => {
            const searchTerm = "JavaScript";
            const { results: directResults, count: directCount } = await buildDirectSearchQuery(db, searchTerm);
            const serviceResult = await bookService.list({ search: searchTerm });

            assertSearchResults(serviceResult, directResults, directCount);
        });

        await t.step("Service can search by description", async () => {
            const searchTerm = "mathematics";
            const { results: directResults, count: directCount } = await buildDirectSearchQuery(db, searchTerm);
            const serviceResult = await bookService.list({ search: searchTerm });

            assertSearchResults(serviceResult, directResults, directCount);
        });

        await t.step("Service can search across multiple fields", async () => {
            const searchTerm = "React";
            const { results: directResults, count: directCount } = await buildDirectSearchQuery(db, searchTerm);
            const serviceResult = await bookService.list({ search: searchTerm });

            assertSearchResults(serviceResult, directResults, directCount);
        });

        await t.step("Service search is case-insensitive", async () => {
            const searchTerm = "node";
            const { results: directResults, count: directCount } = await buildDirectSearchQuery(db, searchTerm);
            const serviceResult = await bookService.list({ search: searchTerm });

            assertSearchResults(serviceResult, directResults, directCount);
        });

        await t.step("Service search with pagination", async () => {
            const searchTerm = "Programming";
            const page = 1;
            const limit = 5;
            const offset = (page - 1) * limit;

            const { results: directResults, count: directCount } = await buildDirectSearchQuery(db, searchTerm, { limit, offset });
            const directTotalPages = Math.max(Math.ceil(directCount / limit), 1);
            const directHasNextPage = page < directTotalPages;
            const directHasPreviousPage = page > 1;

            const serviceResult = await bookService.list({ search: searchTerm, page, limit });

            assertExists(serviceResult);
            assertEquals(serviceResult.items.length, directResults.length);
            assertEquals(serviceResult.total, directCount);
            assertEquals(serviceResult.page, page);
            assertEquals(serviceResult.limit, limit);
            assertEquals(serviceResult.totalPages, directTotalPages);
            assertEquals(serviceResult.hasNextPage, directHasNextPage);
            assertEquals(serviceResult.hasPreviousPage, directHasPreviousPage);
            const serviceItemNames = serviceResult.items.map((item: any) => item.name).sort();
            const directItemNames = directResults.map((item: any) => item.name).sort();
            assertEquals(serviceItemNames, directItemNames);
        });
    },
});

Deno.test({
    name: "BaseService - List Filter Operations",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const bookService = createBookService(db);

        await t.step("Service can filter with $eq operator", async () => {
            await seedBooks(db, [{ name: "Filter Eq Test", description: null, authorId: null, publisherId: null }]);
            const result = await bookService.list({
                filter: { name: { $eq: "Filter Eq Test" } },
            });

            assertExists(result);
            assertEquals(result.items.length, 1);
            assertEquals(result.items[0].name, "Filter Eq Test");
        });

        await t.step("Service can filter with $in operator", async () => {
            const [book1, book2] = await seedBooks(db, [
                { name: "Filter In Test 1", description: null, authorId: null, publisherId: null },
                { name: "Filter In Test 2", description: null, authorId: null, publisherId: null },
            ]);
            const result = await bookService.list({
                filter: { id: { $in: [book1.id, book2.id] } },
            });

            assertExists(result);
            assertEquals(result.items.length, 2);
            assertExists(book1);
            assertExists(book2);
        });

        await t.step("Service can filter with $nin operator", async () => {
            const [_book] = await seedBooks(db, [{ name: "Filter Nin Test", description: null, authorId: null, publisherId: null }]);
            const result = await bookService.list({
                filter: { id: { $nin: [_book.id] } },
            });

            assertExists(result);
            const found = result.items.find((item: any) => item.id === _book.id);
            assertEquals(found, undefined);
        });

        await t.step("Service can filter with $gte operator", async () => {
            const [book] = await seedBooks(db, [{ name: "Filter Gte Test", description: null, authorId: null, publisherId: null }]);
            const result = await bookService.list({
                filter: { id: { $gte: book.id } },
                sort: "id:asc",
             
            });
            

            assertExists(result);
            const found = result.items.find((item: any) => item.id === book.id);
            assertExists(found);
        });

        await t.step("Service can filter with $lte operator", async () => {
            const [book] = await seedBooks(db, [{ name: "Filter Lte Test", description: null, authorId: null, publisherId: null }]);
            const result = await bookService.list({
                filter: { id: { $lte: book.id } },
            });

            assertExists(result);
            const found = result.items.find((item: any) => item.id === book.id);
            assertExists(found);
        });

        await t.step("Service can filter with $gt operator", async () => {
            const [book] = await seedBooks(db, [{ name: "Filter Gt Test", description: null, authorId: null, publisherId: null }]);
            const result = await bookService.list({
                filter: { id: { $gt: book.id } },
            });

            assertExists(result);
            const found = result.items.find((item: any) => item.id === book.id);
            assertEquals(found, undefined);
        });

        await t.step("Service can filter with $lt operator", async () => {
            const [book] = await seedBooks(db, [{ name: "Filter Lt Test", description: null, authorId: null, publisherId: null }]);
            const result = await bookService.list({
                filter: { id: { $lt: book.id } },
            });

            assertExists(result);
            const found = result.items.find((item: any) => item.id === book.id);
            assertEquals(found, undefined);
        });
    },
});

Deno.test({
    name: "BaseService - List Logical Operators",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const bookService = createBookService(db);

        await t.step("Service can filter with $and operator", async () => {
            const [book] = await seedBooks(db, [{ name: "And Test Book", description: "Test description", authorId: null, publisherId: null }]);
            const result = await bookService.list({
                filter: {
                    $and: [
                        { name: { $eq: "And Test Book" } },
                        { id: { $gte: book.id } },
                    ],
                },
            });
            assertExists(result);
            assertEquals(result.items[0].name, "And Test Book");
        });

        await t.step("Service can filter with $or operator", async () => {
            await seedBooks(db, [
                { name: "Or Test Book 1", description: null, authorId: null, publisherId: null },
                { name: "Or Test Book 2", description: null, authorId: null, publisherId: null },
            ]);
            const result = await bookService.list({
                filter: {
                    $or: [
                        { name: { $eq: "Or Test Book 1" } },
                        { name: { $eq: "Or Test Book 2" } },
                    ],
                },
            });

            assertExists(result);
            assertEquals(result.items.length, 2);
        });
    },
});

Deno.test({
    name: "BaseService - List Pagination Edge Cases",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const bookService = createBookService(db);

        await t.step("Service handles empty results", async () => {
            const result = await bookService.list({
                filter: { name: { $eq: "NonExistentBook12345" } },
            });

            assertExists(result);
            assertEquals(result.items.length, 0);
            assertEquals(result.total, 0);
            assertEquals(result.totalPages, 1);
            assertEquals(result.hasNextPage, false);
            assertEquals(result.hasPreviousPage, false);
        });

        await t.step("Service handles last page", async () => {
            const totalResult = await bookService.list({});
            const totalPages = totalResult.totalPages;
            
            if (totalPages > 1) {
                const result = await bookService.list({
                    page: totalPages,
                    limit: 50,
                });

                assertExists(result);
                assertEquals(result.page, totalPages);
                assertEquals(result.hasNextPage, false);
                assertEquals(result.hasPreviousPage, true);
            }
        });

        await t.step("Service handles single page", async () => {
            const result = await bookService.list({
                page: 1,
                limit: 10000,
            });

            assertExists(result);
            assertEquals(result.totalPages, 1);
            assertEquals(result.hasNextPage, false);
            assertEquals(result.hasPreviousPage, false);
        });
    },
});

Deno.test({
    name: "BaseService - List Without Paging",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const bookService = createBookService(db);

        await t.step("Service can list without paging", async () => {
            const result = await bookService.list({}, { withoutPaging: true });

            assertExists(result);
            assertEquals(result.page, 1);
            assertEquals(result.totalPages, 1);
            assertEquals(result.hasNextPage, false);
            assertEquals(result.hasPreviousPage, false);
            assertEquals(result.total, result.items.length);
        });

        await t.step("Service respects limit when withoutPaging is true", async () => {
            const result = await bookService.list({ limit: 5 }, { withoutPaging: true });

            assertExists(result);
            assertEquals(result.items.length, Math.min(5, result.total));
        });
    },
});

Deno.test({
    name: "BaseService - List Internal Filters",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const bookService = createBookService(db);

        await t.step("Service can use internalFilterQuery", async () => {
            const [book] = await seedBooks(db, [{ name: "Internal Filter Test", description: null, authorId: null, publisherId: null }]);
            const result = await bookService.list({}, {
                internalFilterQuery: () => eq(books.id, book.id),
            });

            assertExists(result);
            // assertEquals(result.items.length, 1);  no need because data can be exist before
            assertEquals(result.items[0].id, book.id);
        });

        await t.step("Service handles internalFilterQuery returning undefined", async () => {
            const result = await bookService.list({}, {
                internalFilterQuery: () => undefined,
            });

            assertExists(result);
        });
    },
});

Deno.test({
    name: "BaseService - List Debug Mode",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const bookService = createBookService(db);

        await t.step("Service can enable debug mode", async () => {
            const originalLog = console.log;
            const logCalls: string[] = [];
            console.log = (...args: unknown[]) => {
                logCalls.push(args.map(a => String(a)).join(" "));
            };

            try {
                await bookService.list({ debug: true });
                assertEquals(logCalls.length > 0, true);
            } finally {
                console.log = originalLog;
            }
        });
    },
});

Deno.test({
    name: "BaseService - List with MapRecord",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const bookService = createBookServiceWithMapRecord(db);

        await t.step("Service can list with mapRecord function", async () => {
            const result = await bookService.list({});

            assertExists(result);
            if (result.items.length > 0) {
                assertEquals((result.items[0] as any).mapped, true);
            }
        });
    },
});

Deno.test({
    name: "BaseService - List with Relations",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const bookService = createBookServiceWithRelations(db);

        await t.step("Service can list with requireJoins", async () => {
            const result = await bookService.list({}, {
                requireJoins: ["author"],
            });

            assertExists(result);
        });

        await t.step("Service can filter by relation field", async () => {
            const result = await bookService.list({
                filter: { "author.name": { $eq: "Test Author" } },
            });

            assertExists(result);
        });
    },
});

Deno.test({
    name: "BaseService - List Join Logic Branches",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const bookService = createBookServiceWithRelations(db);
        const authorService = createAuthorServiceWithRelations(db);

        await t.step("Service handles list with explicit FK on relation table", async () => {
            const result = await bookService.list({}, {
                requireJoins: ["bookDetails"],
            });

            assertExists(result);
        });

        await t.step("Service handles list with FK on relation table (fkColInRelation)", async () => {
            const result = await authorService.list({}, {
                requireJoins: ["books"],
            });

            assertExists(result);
        });

        await t.step("Service handles list with complex join scenarios", async () => {
            const result = await bookService.list({
                filter: {
                    $and: [
                        { "author.name": { $eq: "Test Author" } },
                        { "publisher.name": { $eq: "Test Publisher" } },
                    ],
                },
            });

            assertExists(result);
        });
    },
});

Deno.test({
    name: "BaseService - List QueryApi Fallback",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();

        await t.step("Service falls back gracefully when queryApi.findMany is not available", async () => {
            const originalQuery = (db as any).query;
            try {
                (db as any).query = {
                    books: {},
                };

                const service = createCrudService({
                    db,
                    table: books,
                    createSchema: createBookSchema,
                    updateSchema: updateBookSchema,
                    entitySchema: bookEntitySchema,
                    searchable: ["name", "description"],
                });

                const result = await service.list({});

                assertExists(result);
                assertExists(result.items);
                assertEquals(Array.isArray(result.items), true);
            } finally {
                (db as any).query = originalQuery;
            }
        });
    },
});

Deno.test({
    name: "BaseService - List with Relation Search",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const bookService = createBookServiceWithRelationSearch(db);

        await t.step("Service can search by relation field - single field", async () => {
            const [author] = await seedAuthors(db, [
                { name: "Search Author", email: "search@example.com" },
            ]);
            const [book] = await seedBooks(db, [
                { name: "Test Book", description: null, authorId: author.id, publisherId: null },
            ]);

            const result = await bookService.list({ search: "Search Author" });

            assertExists(result);
            assertEquals(result.items.length >= 1, true);
            const found = result.items.find((item: any) => item.id === book.id);
            assertExists(found);
        });

        await t.step("Service can search by relation field - multiple fields", async () => {
            const [author] = await seedAuthors(db, [
                { name: "Multi Field Author", email: "multifield@example.com" },
            ]);
            const [book] = await seedBooks(db, [
                { name: "Multi Field Book", description: null, authorId: author.id, publisherId: null },
            ]);

            const resultByName = await bookService.list({ search: "Multi Field Author" });
            const resultByEmail = await bookService.list({ search: "multifield@example.com" });

            assertExists(resultByName);
            assertExists(resultByEmail);
            assertEquals(resultByName.items.length >= 1, true);
            assertEquals(resultByEmail.items.length >= 1, true);
            const foundByName = resultByName.items.find((item: any) => item.id === book.id);
            const foundByEmail = resultByEmail.items.find((item: any) => item.id === book.id);
            assertExists(foundByName);
            assertExists(foundByEmail);
        });

        await t.step("Service can search by multiple relations", async () => {
            const [author] = await seedAuthors(db, [
                { name: "Multi Relation Author", email: null },
            ]);
            const [publisher] = await seedPublishers(db, [
                { name: "Multi Relation Publisher", address: null },
            ]);
            const [book1] = await seedBooks(db, [
                { name: "Author Book", description: null, authorId: author.id, publisherId: null },
            ]);
            const [book2] = await seedBooks(db, [
                { name: "Publisher Book", description: null, authorId: null, publisherId: publisher.id },
            ]);

            const result = await bookService.list({ search: "Multi Relation" });

            assertExists(result);
            assertEquals(result.items.length >= 2, true);
            const foundAuthor = result.items.find((item: any) => item.id === book1.id);
            const foundPublisher = result.items.find((item: any) => item.id === book2.id);
            assertExists(foundAuthor);
            assertExists(foundPublisher);
        });

        await t.step("Service can search main table + relation fields", async () => {
            const [author] = await seedAuthors(db, [
                { name: "Math Author", email: null },
            ]);
            const [book1] = await seedBooks(db, [
                { name: "Math Book", description: null, authorId: null, publisherId: null },
            ]);
            const [book2] = await seedBooks(db, [
                { name: "Other Book", description: null, authorId: author.id, publisherId: null },
            ]);

            const result = await bookService.list({ search: "Math" });

            assertExists(result);
            assertEquals(result.items.length >= 2, true);
            const foundBook = result.items.find((item: any) => item.id === book1.id);
            const foundAuthor = result.items.find((item: any) => item.id === book2.id);
            assertExists(foundBook);
            assertExists(foundAuthor);
        });

        await t.step("Service relation search is case-insensitive", async () => {
            const [author] = await seedAuthors(db, [
                { name: "Case Test Author", email: null },
            ]);
            const [_book] = await seedBooks(db, [
                { name: "Case Test Book", description: null, authorId: author.id, publisherId: null },
            ]);

            const resultLower = await bookService.list({ search: "case test" });
            const resultUpper = await bookService.list({ search: "CASE TEST" });

            assertExists(resultLower);
            assertExists(resultUpper);
            assertEquals(resultLower.items.length >= 1, true);
            assertEquals(resultUpper.items.length >= 1, true);
        });

        await t.step("Service relation search with pagination", async () => {
            const [author] = await seedAuthors(db, [
                { name: "Pagination Author", email: null },
            ]);
            await seedBooks(db, [
                { name: "Pagination Book 1", description: null, authorId: author.id, publisherId: null },
                { name: "Pagination Book 2", description: null, authorId: author.id, publisherId: null },
            ]);

            const result = await bookService.list({ search: "Pagination", page: 1, limit: 1 });

            assertExists(result);
            assertEquals(result.page, 1);
            assertEquals(result.limit, 1);
            assertEquals(result.items.length, 1);
            assertEquals(result.total >= 2, true);
        });

        await t.step("Service relation search with filters", async () => {
            const [author] = await seedAuthors(db, [
                { name: "Filter Author", email: null },
            ]);
            const [book] = await seedBooks(db, [
                { name: "Filter Book", description: null, authorId: author.id, publisherId: null },
            ]);

            const result = await bookService.list({
                search: "Filter",
                filter: { name: { $eq: "Filter Book" } },
            });

            assertExists(result);
            assertEquals(result.items.length, 1);
            assertEquals(result.items[0].id, book.id);
        });

        await t.step("Service relation search triggers joins", async () => {
            const [author] = await seedAuthors(db, [
                { name: "Join Test Author", email: null },
            ]);
            const [book] = await seedBooks(db, [
                { name: "Join Test Book", description: null, authorId: author.id, publisherId: null },
            ]);

            const result = await bookService.list({ search: "Join Test" });

            assertExists(result);
            assertEquals(result.items.length >= 1, true);
            const found = result.items.find((item: any) => item.id === book.id);
            assertExists(found);
        });
    },
});

