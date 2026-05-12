import { assertEquals, assertExists } from "@std/assert";
import { eq, or } from "drizzle-orm";
import { getTestDb, setupTestDatabase, closeTestDb, TEST_OPTS } from "../setup/utils.ts";
import { createBookServiceWithRelations, createAuthorServiceWithRelations, createAuthorServiceWithDeepRelations, createGenreServiceWithRelations } from "../fixtures/helpers.ts";
import { books, bookDetails, authors, publishers, bookGenres } from "../setup/schema.ts";
import { seedAuthors, seedPublishers, seedBooks, seedBookDetails, seedGenres, seedBookGenres, type SeedData } from "../fixtures/seed.ts";

// Shared seed data for tests
const sharedSeedData: SeedData = {
    authors: [],
    publishers: [],
    books: [],
    bookDetails: [],
    genres: [],
    bookGenres: [],
};

Deno.test.beforeAll(async () => {
    await setupTestDatabase();
});

Deno.test.afterAll(async () => {
    await closeTestDb();
});

Deno.test({
    name: "BaseService - One-to-One Relations",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const bookService = createBookServiceWithRelations(db);

        await t.step("Service can get book with one-to-one relation", async () => {
            const [book] = await seedBooks(db, [{ name: "Test Book", description: "Test", authorId: null, publisherId: null }]);
            const [detail] = await seedBookDetails(db, [{ bookId: book.id, isbn: "1234567890", pageCount: 300, language: "en" }]);

            const serviceResult = await bookService.get(book.id);

            assertExists(serviceResult);
            assertExists((serviceResult as any).bookDetails);
            
            const dbDetail = await db.select().from(bookDetails).where(eq(bookDetails.id, detail.id)).limit(1);
            assertEquals((serviceResult as any).bookDetails.isbn, dbDetail[0].isbn);
            assertEquals((serviceResult as any).bookDetails.pageCount, dbDetail[0].pageCount);
        });

        await t.step("Service can list books with one-to-one relation", async () => {
            const [book1, book2] = await seedBooks(db, [
                { name: "OneToOne Book 1", description: null, authorId: null, publisherId: null },
                { name: "OneToOne Book 2", description: null, authorId: null, publisherId: null }
            ]);
            await seedBookDetails(db, [
                { bookId: book1.id, isbn: "1111111111", pageCount: null, language: null },
                { bookId: book2.id, isbn: "2222222222", pageCount: null, language: null }
            ]);

            const serviceResult = await bookService.list({ 
                filter: { id: { $in: [book1.id, book2.id] } } as any
            });

            assertExists(serviceResult);
            const item1 = serviceResult.items.find((item: any) => item.id === book1.id);
            const item2 = serviceResult.items.find((item: any) => item.id === book2.id);
            assertExists(item1);
            assertExists(item2);
            assertExists((item1 as any).bookDetails);
            assertExists((item2 as any).bookDetails);
            
            const dbDetails = await db.select().from(bookDetails).where(
                or(eq(bookDetails.bookId, book1.id), eq(bookDetails.bookId, book2.id))
            );
            assertEquals(dbDetails.length, 2);
        });

        await t.step("Service can filter by one-to-one relation field", async () => {
            const [book1, book2] = await seedBooks(db, [
                { name: "Filter Book 1", description: null, authorId: null, publisherId: null },
                { name: "Filter Book 2", description: null, authorId: null, publisherId: null }
            ]);
            await seedBookDetails(db, [
                { bookId: book1.id, isbn: "MATCH123", pageCount: null, language: null },
                { bookId: book2.id, isbn: "NOMATCH456", pageCount: null, language: null }
            ]);

            const serviceResult = await bookService.list({ 
                filter: { "bookDetails.isbn": { $eq: "MATCH123" } } as any
            });

            assertExists(serviceResult);
            assertEquals(serviceResult.items.length, 1);
            
            const dbBook = await db.select().from(books).where(eq(books.id, book1.id)).limit(1);
            assertEquals(serviceResult.items[0].id, dbBook[0].id);
        });

        await t.step("Service can sort by one-to-one relation field", async () => {
            const [book1, book2] = await seedBooks(db, [
                { name: "Sort Book 1", description: null, authorId: null, publisherId: null },
                { name: "Sort Book 2", description: null, authorId: null, publisherId: null }
            ]);
            await seedBookDetails(db, [
                { bookId: book1.id, isbn: "book01", pageCount: 200, language: null },
                { bookId: book2.id, isbn: "book02", pageCount: 100, language: null }
            ]);

            const serviceResult = await bookService.list({ sort: "bookDetails.pageCount:asc", filter:{
                id: { $in: [book1.id, book2.id] }
            } });

            assertExists(serviceResult);
            const dbDetails = await db.select().from(bookDetails).where(
                or(eq(bookDetails.bookId, book1.id), eq(bookDetails.bookId, book2.id))
            ).orderBy(bookDetails.pageCount);
            
            assertEquals(serviceResult.items.length, 2);
            assertEquals(serviceResult.items[0].id, dbDetails[0].bookId);
            assertEquals(serviceResult.items[1].id, dbDetails[1].bookId);
        });
    },
});

Deno.test({
    name: "BaseService - One-to-Many Relations",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const authorService = createAuthorServiceWithRelations(db);

        await t.step("Service can get author with one-to-many relation", async () => {
            const [author] = await seedAuthors(db, [{ name: "OneToMany Author", email: "onetomany@example.com" }]);
            const [book1, book2] = await seedBooks(db, [
                { name: "OneToMany Book 1", description: null, authorId: author.id, publisherId: null },
                { name: "OneToMany Book 2", description: null, authorId: author.id, publisherId: null }
            ]);

            const serviceResult = await authorService.get(author.id);

            assertExists(serviceResult);
            assertExists((serviceResult as any).books);
            
            const dbBooks = await db.select().from(books).where(eq(books.authorId, author.id));
            assertEquals((serviceResult as any).books.length, dbBooks.length);
            assertEquals(dbBooks.length, 2);
            assertExists(dbBooks.find(b => b.id === book1.id));
            assertExists(dbBooks.find(b => b.id === book2.id));
        });

        await t.step("Service can list authors with one-to-many relation", async () => {
            const [author1, author2] = await seedAuthors(db, [
                { name: "List Author 1", email: null },
                { name: "List Author 2", email: null }
            ]);
            await seedBooks(db, [
                { name: "List Book A", description: null, authorId: author1.id, publisherId: null },
                { name: "List Book B", description: null, authorId: author1.id, publisherId: null },
                { name: "List Book C", description: null, authorId: author2.id, publisherId: null }
            ]);

            const serviceResult = await authorService.list({});

            assertExists(serviceResult);
            const item1 = serviceResult.items.find((item: any) => item.id === author1.id);
            const item2 = serviceResult.items.find((item: any) => item.id === author2.id);
            assertExists(item1);
            assertExists(item2);
            assertExists((item1 as any).books);
            assertExists((item2 as any).books);
            
            const dbBooks1 = await db.select().from(books).where(eq(books.authorId, author1.id));
            const dbBooks2 = await db.select().from(books).where(eq(books.authorId, author2.id));
            assertEquals((item1 as any).books.length, dbBooks1.length);
            assertEquals((item2 as any).books.length, dbBooks2.length);
        });

        await t.step("Service can filter by one-to-many relation field", async () => {
            const [author1, author2] = await seedAuthors(db, [
                { name: "Filter Author 1", email: null },
                { name: "Filter Author 2", email: null }
            ]);
            const [targetBook] = await seedBooks(db, [
                { name: "Filter Target Book", description: null, authorId: author1.id, publisherId: null },
                { name: "Filter Other Book", description: null, authorId: author2.id, publisherId: null }
            ]);

            const serviceResult = await authorService.list({ 
                filter: { "books.name": { $eq: "Filter Target Book" } } as any
            });

            assertExists(serviceResult);
            assertEquals(serviceResult.items.length, 1);
            
            const dbBook = await db.select().from(books).where(eq(books.id, targetBook.id)).limit(1);
            const dbAuthor = await db.select().from(authors).where(eq(authors.id, author1.id)).limit(1);
            assertEquals(serviceResult.items[0].id, dbAuthor[0].id);
            assertEquals(dbBook[0].authorId, dbAuthor[0].id);
        });
    },
});

Deno.test({
    name: "BaseService - Many-to-One Relations",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const bookService = createBookServiceWithRelations(db);

        await t.step("Service can get book with many-to-one relations", async () => {
            const author = sharedSeedData.authors.find(a => a.name === "Jane Smith") || 
                (await seedAuthors(db, [{ name: "Jane Smith", email: null }]))[0];
            const publisher = sharedSeedData.publishers.find(p => p.name === "Tech Books Inc") || 
                (await seedPublishers(db, [{ name: "Tech Books Inc", address: null }]))[0];
            const [book] = await seedBooks(db, [{ 
                name: "ManyToOne Test Book", 
                description: null,
                authorId: author.id, 
                publisherId: publisher.id 
            }]);

            const serviceResult = await bookService.get(book.id);

            assertExists(serviceResult);
            assertExists((serviceResult as any).author);
            assertExists((serviceResult as any).publisher);
            
            const dbAuthor = await db.select().from(authors).where(eq(authors.id, author.id)).limit(1);
            const dbPublisher = await db.select().from(publishers).where(eq(publishers.id, publisher.id)).limit(1);
            assertEquals((serviceResult as any).author.name, dbAuthor[0].name);
            assertEquals((serviceResult as any).publisher.name, dbPublisher[0].name);
        });

        await t.step("Service can list books with many-to-one relations", async () => {
            const author = sharedSeedData.authors.find(a => a.name === "Author 1") || 
                (await seedAuthors(db, [{ name: "Author 1", email: null }]))[0];
            const publisher = sharedSeedData.publishers.find(p => p.name === "Publisher Name") || 
                (await seedPublishers(db, [{ name: "Publisher Name", address: null }]))[0];
            const [book1, book2] = await seedBooks(db, [
                { name: "ManyToOne Book 1", description: null, authorId: author.id, publisherId: publisher.id },
                { name: "ManyToOne Book 2", description: null, authorId: author.id, publisherId: publisher.id }
            ]);

            const serviceResult = await bookService.list({
                filter: { id: { $in: [book1.id, book2.id] } } 
            });

            assertExists(serviceResult);
            const matchingItems = serviceResult.items.filter((item: any) => 
                item.id === book1.id || item.id === book2.id
            );
            assertEquals(matchingItems.length, 2);
            
            const dbAuthor = await db.select().from(authors).where(eq(authors.id, author.id)).limit(1);
            const dbPublisher = await db.select().from(publishers).where(eq(publishers.id, publisher.id)).limit(1);
            
            matchingItems.forEach((item: any) => {
                assertExists(item.author);
                assertExists(item.publisher);
                assertEquals(item.author.name, dbAuthor[0].name);
                assertEquals(item.publisher.name, dbPublisher[0].name);
            });
        });

        await t.step("Service can filter by many-to-one relation field", async () => {
            const author1 = sharedSeedData.authors.find(a => a.name === "Author A") || 
                (await seedAuthors(db, [{ name: "Author A", email: null }]))[0];
            const author2 = sharedSeedData.authors.find(a => a.name === "Author B") || 
                (await seedAuthors(db, [{ name: "Author B", email: null }]))[0];
            const [book1] = await seedBooks(db, [
                { name: "Filter ManyToOne Book 1", description: null, authorId: author1.id, publisherId: null },
                { name: "Filter ManyToOne Book 2", description: null, authorId: author2.id, publisherId: null }
            ]);

            const serviceResult = await bookService.list({ 
                filter: { "author.name": { $eq: "Author A" } } as any
            });

            assertExists(serviceResult);
            const dbBook = await db.select().from(books).where(eq(books.id, book1.id)).limit(1);
            const matchingItem = serviceResult.items.find((item: any) => item.id === book1.id);
            assertExists(matchingItem);
            assertEquals(matchingItem.name, dbBook[0].name);
        });

        await t.step("Service can sort by many-to-one relation field", async () => {
            const author1 = sharedSeedData.authors.find(a => a.name === "Zebra Author") || 
                (await seedAuthors(db, [{ name: "Zebra Author", email: null }]))[0];
            const author2 = sharedSeedData.authors.find(a => a.name === "Alpha Author") || 
                (await seedAuthors(db, [{ name: "Alpha Author", email: null }]))[0];
            const [book1, book2] = await seedBooks(db, [
                { name: "Sort ManyToOne Book 1", description: null, authorId: author1.id, publisherId: null },
                { name: "Sort ManyToOne Book 2", description: null, authorId: author2.id, publisherId: null }
            ]);

            const serviceResult = await bookService.list({ sort: "author.name:asc" });

            assertExists(serviceResult);
            const matchingItems = serviceResult.items.filter((item: any) => 
                item.id === book1.id || item.id === book2.id
            );
            assertEquals(matchingItems.length, 2);
            // Verify sorting: Alpha Author should come before Zebra Author
            assertEquals(matchingItems[0].id, book2.id);
            assertEquals(matchingItems[1].id, book1.id);
        });
    },
});

Deno.test({
    name: "BaseService - Combined Relations",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const bookService = createBookServiceWithRelations(db);

        await t.step("Service can combine multiple relation filters", async () => {
            const author1 = sharedSeedData.authors.find(a => a.name === "Target Author") || 
                (await seedAuthors(db, [{ name: "Target Author", email: null }]))[0];
            const author2 = sharedSeedData.authors.find(a => a.name === "Other Author") || 
                (await seedAuthors(db, [{ name: "Other Author", email: null }]))[0];
            const publisher1 = sharedSeedData.publishers.find(p => p.name === "Target Publisher") || 
                (await seedPublishers(db, [{ name: "Target Publisher", address: null }]))[0];
            const publisher2 = sharedSeedData.publishers.find(p => p.name === "Other Publisher") || 
                (await seedPublishers(db, [{ name: "Other Publisher", address: null }]))[0];
            const [matchBook] = await seedBooks(db, [
                { name: "Combined Match Book", description: null, authorId: author1.id, publisherId: publisher1.id },
                { name: "Combined No Match 1", description: null, authorId: author1.id, publisherId: publisher2.id },
                { name: "Combined No Match 2", description: null, authorId: author2.id, publisherId: publisher1.id }
            ]);

            const serviceResult = await bookService.list({ 
                filter: { 
                    "author.name": { $eq: "Target Author" },
                    "publisher.name": { $eq: "Target Publisher" }
                } as any
            });

            assertExists(serviceResult);
            assertEquals(serviceResult.items.length, 1);
            
            const dbBook = await db.select().from(books).where(eq(books.id, matchBook.id)).limit(1);
            assertEquals(serviceResult.items[0].name, dbBook[0].name);
        });

        await t.step("Service can combine search with relation filters", async () => {
            const author1 = sharedSeedData.authors.find(a => a.name === "Target Author") || 
                (await seedAuthors(db, [{ name: "Target Author", email: null }]))[0];
            const author2 = sharedSeedData.authors.find(a => a.name === "Other Author") || 
                (await seedAuthors(db, [{ name: "Other Author", email: null }]))[0];
            const [targetBook] = await seedBooks(db, [
                { name: "Combined Programming Guide", description: "Programming content", authorId: author1.id, publisherId: null },
                { name: "Combined Cooking Book", description: "Cooking content", authorId: author1.id, publisherId: null },
                { name: "Combined Programming Advanced", description: "Advanced programming", authorId: author2.id, publisherId: null }
            ]);

            const serviceResult = await bookService.list({ 
                search: "Programming",
                filter: { "author.name": { $eq: "Target Author" } } as any
            });

            assertExists(serviceResult);
            assertEquals(serviceResult.items.length, 1);
            
            const dbBook = await db.select().from(books).where(eq(books.id, targetBook.id)).limit(1);
            assertEquals(serviceResult.items[0].name, dbBook[0].name);
        });

        await t.step("Service can combine search with relation sorting", async () => {
            const publisher1 = sharedSeedData.publishers.find(p => p.name === "Zebra Publisher") || 
                (await seedPublishers(db, [{ name: "Zebra Publisher", address: null }]))[0];
            const publisher2 = sharedSeedData.publishers.find(p => p.name === "Alpha Publisher") || 
                (await seedPublishers(db, [{ name: "Alpha Publisher", address: null }]))[0];
            const [book1, book2] = await seedBooks(db, [
                { name: "Combined Test Book Z", description: "Test content", authorId: null, publisherId: publisher1.id },
                { name: "Combined Test Book A", description: "Test content", authorId: null, publisherId: publisher2.id }
            ]);

            const serviceResult = await bookService.list({ 
                search: "Test",
                sort: "publisher.name:asc"
            });

            assertExists(serviceResult);
            const matchingItems = serviceResult.items.filter((item: any) => 
                item.id === book1.id || item.id === book2.id
            );
            assertEquals(matchingItems.length, 2);
            // Verify sorting: Alpha Publisher should come before Zebra Publisher
            assertEquals(matchingItems[0].id, book2.id);
            assertEquals(matchingItems[1].id, book1.id);
        });
    },
});

Deno.test({
    name: "BaseService - Deep Relations (Author -> Books -> BookDetails)",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const authorService = createAuthorServiceWithDeepRelations(db);

        await t.step("Service can get author with deep relations (books -> bookDetails)", async () => {
            const [author] = await seedAuthors(db, [{ name: "Deep Relation Author", email: "deep@example.com" }]);
            const [book1, book2] = await seedBooks(db, [
                { name: "Deep Book 1", description: null, authorId: author.id, publisherId: null },
                { name: "Deep Book 2", description: null, authorId: author.id, publisherId: null }
            ]);
            await seedBookDetails(db, [
                { bookId: book1.id, isbn: "DEEP001", pageCount: 250, language: "en" },
                { bookId: book2.id, isbn: "DEEP002", pageCount: 300, language: "fr" }
            ]);

            const serviceResult = await authorService.get(author.id);

            assertExists(serviceResult);
            assertExists((serviceResult as any).books);
            assertEquals((serviceResult as any).books.length, 2);
            
            const book1Result = (serviceResult as any).books.find((b: any) => b.id === book1.id);
            const book2Result = (serviceResult as any).books.find((b: any) => b.id === book2.id);
            assertExists(book1Result);
            assertExists(book2Result);
            
            const dbDetails = await db.select().from(bookDetails).where(
                or(eq(bookDetails.bookId, book1.id), eq(bookDetails.bookId, book2.id))
            );
            assertEquals(dbDetails.length, 2);
        });

        await t.step("Service can list authors with deep relations", async () => {
            const [author1, author2] = await seedAuthors(db, [
                { name: "Deep List Author 1", email: null },
                { name: "Deep List Author 2", email: null }
            ]);
            const [book1, book2] = await seedBooks(db, [
                { name: "Deep List Book 1", description: null, authorId: author1.id, publisherId: null },
                { name: "Deep List Book 2", description: null, authorId: author2.id, publisherId: null }
            ]);
            await seedBookDetails(db, [
                { bookId: book1.id, isbn: "DL001", pageCount: 100, language: null },
                { bookId: book2.id, isbn: "DL002", pageCount: 200, language: null }
            ]);

            const serviceResult = await authorService.list({
                filter: { id: { $in: [author1.id, author2.id] } } as any
            });

            assertExists(serviceResult);
            const item1 = serviceResult.items.find((item: any) => item.id === author1.id);
            const item2 = serviceResult.items.find((item: any) => item.id === author2.id);
            assertExists(item1);
            assertExists(item2);
            assertExists((item1 as any).books);
            assertExists((item2 as any).books);
            assertEquals((item1 as any).books.length, 1);
            assertEquals((item2 as any).books.length, 1);
        });

      
    },
});

Deno.test({
    name: "BaseService - Many-to-Many Relations (Books <-> Genres)",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const bookService = createBookServiceWithRelations(db);
        const genreService = createGenreServiceWithRelations(db);

        await t.step("Service can get book with many-to-many relation (genres)", async () => {
            const [book] = await seedBooks(db, [{ name: "ManyToMany Book", description: null, authorId: null, publisherId: null }]);
            const [genre1, genre2] = await seedGenres(db, [
                { name: "Fiction", description: null },
                { name: "Science", description: null }
            ]);
            await seedBookGenres(db, [
                { bookId: book.id, genreId: genre1.id },
                { bookId: book.id, genreId: genre2.id }
            ]);

            const serviceResult = await bookService.get(book.id);

            assertExists(serviceResult);
            assertExists((serviceResult as any).genres);
            
            const dbBookGenres = await db.select().from(bookGenres).where(eq(bookGenres.bookId, book.id));
            assertEquals(dbBookGenres.length, 2);
        });

        await t.step("Service can get genre with many-to-many relation (books)", async () => {
            const [genre] = await seedGenres(db, [{ name: "ManyToMany Genre", description: null }]);
            const [book1, book2] = await seedBooks(db, [
                { name: "ManyToMany Book A", description: null, authorId: null, publisherId: null },
                { name: "ManyToMany Book B", description: null, authorId: null, publisherId: null }
            ]);
            await seedBookGenres(db, [
                { bookId: book1.id, genreId: genre.id },
                { bookId: book2.id, genreId: genre.id }
            ]);

            const serviceResult = await genreService.get(genre.id);

            assertExists(serviceResult);
            assertExists((serviceResult as any).books);
            
            const dbBookGenres = await db.select().from(bookGenres).where(eq(bookGenres.genreId, genre.id));
            assertEquals(dbBookGenres.length, 2);
        });

        await t.step("Service can list books with many-to-many relation", async () => {
            const [book1, book2] = await seedBooks(db, [
                { name: "ManyToMany List Book 1", description: null, authorId: null, publisherId: null },
                { name: "ManyToMany List Book 2", description: null, authorId: null, publisherId: null }
            ]);
            const [genre1, genre2] = await seedGenres(db, [
                { name: "Technology", description: null },
                { name: "Programming", description: null }
            ]);
            await seedBookGenres(db, [
                { bookId: book1.id, genreId: genre1.id },
                { bookId: book2.id, genreId: genre2.id }
            ]);

            const serviceResult = await bookService.list({
                filter: { id: { $in: [book1.id, book2.id] } } as any
            });

            assertExists(serviceResult);
            const item1 = serviceResult.items.find((item: any) => item.id === book1.id);
            const item2 = serviceResult.items.find((item: any) => item.id === book2.id);
            assertExists(item1);
            assertExists(item2);
            assertExists((item1 as any).genres);
            assertExists((item2 as any).genres);
        });

        await t.step("Service can list genres with many-to-many relation", async () => {
            const [genre1, genre2] = await seedGenres(db, [
                { name: "Mystery", description: null },
                { name: "Thriller", description: null }
            ]);
            const [book1, book2] = await seedBooks(db, [
                { name: "ManyToMany List Genre Book 1", description: null, authorId: null, publisherId: null },
                { name: "ManyToMany List Genre Book 2", description: null, authorId: null, publisherId: null }
            ]);
            await seedBookGenres(db, [
                { bookId: book1.id, genreId: genre1.id },
                { bookId: book2.id, genreId: genre2.id }
            ]);

            const serviceResult = await genreService.list({
                filter: { id: { $in: [genre1.id, genre2.id] } } as any
            });

            assertExists(serviceResult);
            const item1 = serviceResult.items.find((item: any) => item.id === genre1.id);
            const item2 = serviceResult.items.find((item: any) => item.id === genre2.id);
            assertExists(item1);
            assertExists(item2);
            assertExists((item1 as any).books);
            assertExists((item2 as any).books);
        });

        await t.step("Service can filter books by many-to-many relation field (genres.name)", async () => {
            const [book1, book2] = await seedBooks(db, [
                { name: "Filter ManyToMany Book 1", description: null, authorId: null, publisherId: null },
                { name: "Filter ManyToMany Book 2", description: null, authorId: null, publisherId: null }
            ]);
            const [genre1, genre2] = await seedGenres(db, [
                { name: "Non-Fiction", description: null },
                { name: "Biography", description: null }
            ]);
            await seedBookGenres(db, [
                { bookId: book1.id, genreId: genre1.id },
                { bookId: book2.id, genreId: genre2.id }
            ]);

            const serviceResult = await bookService.list({
                filter: { "genres.name": { $eq: "Non-Fiction" } } as any
            });

            assertExists(serviceResult);
            const matchingItem = serviceResult.items.find((item: any) => item.id === book1.id);
            assertExists(matchingItem);
        });

        await t.step("Service can filter genres by many-to-many relation field (books.name)", async () => {
            const [genre1, _genre2] = await seedGenres(db, [
                { name: "Fantasy", description: null },
                { name: "Horror", description: null }
            ]);
            const [book1] = await seedBooks(db, [
                { name: "Filter Genre Book", description: null, authorId: null, publisherId: null },
                { name: "Other Book", description: null, authorId: null, publisherId: null }
            ]);
            await seedBookGenres(db, [
                { bookId: book1.id, genreId: genre1.id }
            ]);

            const serviceResult = await genreService.list({
                filter: { "books.name": { $eq: "Filter Genre Book" } } as any
            });

            assertExists(serviceResult);
            const matchingItem = serviceResult.items.find((item: any) => item.id === genre1.id);
            assertExists(matchingItem);
        });

        await t.step("Service can sort books by many-to-many relation field", async () => {
            const [book1, book2] = await seedBooks(db, [
                { name: "Sort ManyToMany Book 1", description: null, authorId: null, publisherId: null },
                { name: "Sort ManyToMany Book 2", description: null, authorId: null, publisherId: null }
            ]);
            const [genre1, genre2] = await seedGenres(db, [
                { name: "Zebra Genre", description: null },
                { name: "Alpha Genre", description: null }
            ]);
            await seedBookGenres(db, [
                { bookId: book1.id, genreId: genre1.id },
                { bookId: book2.id, genreId: genre2.id }
            ]);

            const serviceResult = await bookService.list({
                sort: "genres.name:asc",
                filter: { id: { $in: [book1.id, book2.id] } } as any
            });

            assertExists(serviceResult);
            assertEquals(serviceResult.items.length, 2);
            const matchingItems = serviceResult.items.filter((item: any) => 
                item.id === book1.id || item.id === book2.id
            );
            assertEquals(matchingItems[0].id, book2.id);
            assertEquals(matchingItems[1].id, book1.id);
        });

        await t.step("Service can filter books matching multiple genres", async () => {
            const [book1, book2] = await seedBooks(db, [
                { name: "Multi Genre Book", description: null, authorId: null, publisherId: null },
                { name: "Single Genre Book", description: null, authorId: null, publisherId: null }
            ]);
            const [genre1, genre2, genre3] = await seedGenres(db, [
                { name: "Action", description: null },
                { name: "Adventure", description: null },
                { name: "Drama", description: null }
            ]);
            await seedBookGenres(db, [
                { bookId: book1.id, genreId: genre1.id },
                { bookId: book1.id, genreId: genre2.id },
                { bookId: book2.id, genreId: genre3.id }
            ]);

            const serviceResult = await bookService.list({
                filter: {
                    $and: [
                        { "genres.name": { $eq: "Action" } },
                        { "genres.name": { $eq: "Adventure" } }
                    ]
                } as any
            });

            assertExists(serviceResult);
            const matchingItem = serviceResult.items.find((item: any) => item.id === book1.id);
            assertExists(matchingItem);
        });
    },
});

Deno.test({
    name: "BaseService - Combined Deep and Many-to-Many Relations",
    ...TEST_OPTS,
    fn: async (t) => {
        const db = getTestDb();
        const authorService = createAuthorServiceWithDeepRelations(db);
        const bookService = createBookServiceWithRelations(db);

        await t.step("Service can combine deep relations with many-to-many", async () => {
            const [author] = await seedAuthors(db, [{ name: "Combined Author", email: null }]);
            const [book] = await seedBooks(db, [
                { name: "Combined Book", description: null, authorId: author.id, publisherId: null }
            ]);
            await seedBookDetails(db, [
                { bookId: book.id, isbn: "COMBINED001", pageCount: 400, language: "en" }
            ]);
            const [genre1, genre2] = await seedGenres(db, [
                { name: "Science Fiction", description: null },
                { name: "Dystopian", description: null }
            ]);
            await seedBookGenres(db, [
                { bookId: book.id, genreId: genre1.id },
                { bookId: book.id, genreId: genre2.id }
            ]);

            const authorResult = await authorService.get(author.id);
            assertExists(authorResult);
            assertExists((authorResult as any).books);
            const authorBook = (authorResult as any).books.find((b: any) => b.id === book.id);
            assertExists(authorBook);

            const bookResult = await bookService.get(book.id);
            assertExists(bookResult);
            assertExists((bookResult as any).genres);
            assertEquals((bookResult as any).genres.length, 2);
        });


        await t.step("Service can combine search with deep and many-to-many relations", async () => {
            const [author] = await seedAuthors(db, [{ name: "Combined Search Author", email: null }]);
            const [book] = await seedBooks(db, [
                { name: "Combined Search Book", description: "Programming guide", authorId: author.id, publisherId: null }
            ]);
            await seedBookDetails(db, [
                { bookId: book.id, isbn: "CSEARCH001", pageCount: 500, language: "en" }
            ]);
            const [genre] = await seedGenres(db, [
                { name: "Technical", description: null }
            ]);
            await seedBookGenres(db, [
                { bookId: book.id, genreId: genre.id }
            ]);

            const serviceResult = await bookService.list({
                search: "Programming",
                filter: {
                    "author.name": { $eq: "Combined Search Author" },
                    "genres.name": { $eq: "Technical" }
                } as any
            });

            assertExists(serviceResult);
            const matchingItem = serviceResult.items.find((item: any) => item.id === book.id);
            assertExists(matchingItem);
        });
    },
});
