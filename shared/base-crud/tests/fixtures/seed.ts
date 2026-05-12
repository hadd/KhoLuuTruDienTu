import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import {
    authors,
    books,
    bookDetails,
    publishers,
    genres,
    bookGenres,
    type NewAuthor,
    type NewPublisher,
    type NewBook,
    type NewBookDetail,
    type NewGenre,
    type NewBookGenre,
    type Author,
    type Publisher,
    type Book,
    type BookDetail,
    type Genre,
    type BookGenre,
} from "../setup/schema.ts";

// Shared seed data structure
export interface SeedData {
    authors: Author[];
    publishers: Publisher[];
    books: Book[];
    bookDetails: BookDetail[];
    genres: Genre[];
    bookGenres: BookGenre[];
}

// Predefined UUIDs for stable test data
export const SEED_UUIDS = {
    authors: {
        johnDoe: "00000000-0000-0000-0000-000000000001",
        janeSmith: "00000000-0000-0000-0000-000000000002",
        author1: "00000000-0000-0000-0000-000000000003",
        author2: "00000000-0000-0000-0000-000000000004",
        authorA: "00000000-0000-0000-0000-000000000005",
        authorB: "00000000-0000-0000-0000-000000000006",
        targetAuthor: "00000000-0000-0000-0000-000000000007",
        otherAuthor: "00000000-0000-0000-0000-000000000008",
        zebraAuthor: "00000000-0000-0000-0000-000000000009",
        alphaAuthor: "00000000-0000-0000-0000-00000000000a",
    },
    publishers: {
        techBooksInc: "00000000-0000-0000-0000-000000000101",
        publisherName: "00000000-0000-0000-0000-000000000102",
        targetPublisher: "00000000-0000-0000-0000-000000000103",
        otherPublisher: "00000000-0000-0000-0000-000000000104",
        zebraPublisher: "00000000-0000-0000-0000-000000000105",
        alphaPublisher: "00000000-0000-0000-0000-000000000106",
    },
    books: {
        book1: "00000000-0000-0000-0000-000000000201",
        book2: "00000000-0000-0000-0000-000000000202",
        book3: "00000000-0000-0000-0000-000000000203",
        book4: "00000000-0000-0000-0000-000000000204",
        book5: "00000000-0000-0000-0000-000000000205",
        javascriptGuide: "00000000-0000-0000-0000-000000000206",
        pythonBasics: "00000000-0000-0000-0000-000000000207",
        typescriptAdvanced: "00000000-0000-0000-0000-000000000208",
        bookA: "00000000-0000-0000-0000-000000000209",
        bookB: "00000000-0000-0000-0000-00000000020a",
        bookC: "00000000-0000-0000-0000-00000000020b",
        reactGuide: "00000000-0000-0000-0000-00000000020c",
        vueBasics: "00000000-0000-0000-0000-00000000020d",
        angularAdvanced: "00000000-0000-0000-0000-00000000020e",
        nodejsGuide: "00000000-0000-0000-0000-00000000020f",
        expressFramework: "00000000-0000-0000-0000-000000000210",
    },
    genres: {
        fiction: "00000000-0000-0000-0000-000000000301",
        nonFiction: "00000000-0000-0000-0000-000000000302",
        science: "00000000-0000-0000-0000-000000000303",
        technology: "00000000-0000-0000-0000-000000000304",
        programming: "00000000-0000-0000-0000-000000000305",
        mystery: "00000000-0000-0000-0000-000000000306",
    },
} as const;

// Seed functions using upsert with batching to avoid lock contention
const BATCH_SIZE = 5;

export async function seedAuthors(db: PostgresJsDatabase<any>, authorsData: NewAuthor[]): Promise<Author[]> {
    const results: Author[] = [];
    // Process in batches to avoid unique constraint lock contention
    for (let i = 0; i < authorsData.length; i += BATCH_SIZE) {
        const batch = authorsData.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
            batch.map((author) => {
                if (author.id) {
                    return db.insert(authors)
                        .values(author)
                        .onConflictDoUpdate({
                            target: authors.id,
                            set: {
                                name: author.name,
                                email: author.email,
                                deletedAt: null,
                                updatedAt: new Date(),
                            },
                        })
                        .returning();
                } else {
                    return db.insert(authors)
                        .values(author)
                        .onConflictDoUpdate({
                            target: authors.name,
                            set: {
                                email: author.email,
                                deletedAt: null,
                                updatedAt: new Date(),
                            },
                        })
                        .returning();
                }
            })
        );
        results.push(...batchResults.map(r => r[0]));
    }
    return results;
}

export async function seedPublishers(db: PostgresJsDatabase<any>, publishersData: NewPublisher[]): Promise<Publisher[]> {
    const results: Publisher[] = [];
    // Process in batches to avoid unique constraint lock contention
    for (let i = 0; i < publishersData.length; i += BATCH_SIZE) {
        const batch = publishersData.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
            batch.map((publisher) => {
                if (publisher.id) {
                    return db.insert(publishers)
                        .values(publisher)
                        .onConflictDoUpdate({
                            target: publishers.id,
                            set: {
                                name: publisher.name,
                                address: publisher.address,
                                deletedAt: null,
                                updatedAt: new Date(),
                            },
                        })
                        .returning();
                } else {
                    return db.insert(publishers)
                        .values(publisher)
                        .onConflictDoUpdate({
                            target: publishers.name,
                            set: {
                                address: publisher.address,
                                deletedAt: null,
                                updatedAt: new Date(),
                            },
                        })
                        .returning();
                }
            })
        );
        results.push(...batchResults.map(r => r[0]));
    }
    return results;
}

export async function seedBooks(db: PostgresJsDatabase<any>, booksData: NewBook[]): Promise<Book[]> {
    const results: Book[] = [];
    // Process in batches to avoid unique constraint lock contention
    for (let i = 0; i < booksData.length; i += BATCH_SIZE) {
        const batch = booksData.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
            batch.map((book) => {
                if (book.id) {
                    return db.insert(books)
                        .values(book)
                        .onConflictDoUpdate({
                            target: books.id,
                            set: {
                                name: book.name,
                                description: book.description,
                                authorId: book.authorId,
                                publisherId: book.publisherId,
                                deletedAt: null,
                                updatedAt: new Date(),
                            },
                        })
                        .returning();
                } else {
                    return db.insert(books)
                        .values(book)
                        .onConflictDoUpdate({
                            target: books.name,
                            set: {
                                description: book.description,
                                authorId: book.authorId,
                                publisherId: book.publisherId,
                                deletedAt: null,
                                updatedAt: new Date(),
                            },
                        })
                        .returning();
                }
            })
        );
        results.push(...batchResults.map(r => r[0]));
    }
    return results;
}

export async function seedBookDetails(db: PostgresJsDatabase<any>, bookDetailsData: NewBookDetail[]): Promise<BookDetail[]> {
    const results: BookDetail[] = [];
    // Process in batches to avoid unique constraint lock contention
    for (let i = 0; i < bookDetailsData.length; i += BATCH_SIZE) {
        const batch = bookDetailsData.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
            batch.map(async (detail) => {
                if (detail.isbn) {
                    return db.insert(bookDetails)
                        .values(detail)
                        .onConflictDoUpdate({
                            target: bookDetails.isbn,
                            set: {
                                bookId: detail.bookId,
                                pageCount: detail.pageCount,
                                language: detail.language,
                                deletedAt: null,
                                updatedAt: new Date(),
                            },
                        })
                        .returning();
                } else {
                    const insertResult = await db.insert(bookDetails)
                        .values(detail)
                        .onConflictDoNothing()
                        .returning();
                    
                    if (insertResult.length > 0) {
                        return insertResult;
                    }
                    
                    const existing = await db.select()
                        .from(bookDetails)
                        .where(eq(bookDetails.bookId, detail.bookId))
                        .limit(1);
                    
                    return existing;
                }
            })
        );
        results.push(...batchResults.map(r => r[0]));
    }
    return results;
}

export async function seedGenres(db: PostgresJsDatabase<any>, genresData: NewGenre[]): Promise<Genre[]> {
    const results: Genre[] = [];
    for (let i = 0; i < genresData.length; i += BATCH_SIZE) {
        const batch = genresData.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
            batch.map((genre) => {
                if (genre.id) {
                    return db.insert(genres)
                        .values(genre)
                        .onConflictDoUpdate({
                            target: genres.id,
                            set: {
                                name: genre.name,
                                description: genre.description,
                                deletedAt: null,
                                updatedAt: new Date(),
                            },
                        })
                        .returning();
                } else {
                    return db.insert(genres)
                        .values(genre)
                        .onConflictDoUpdate({
                            target: genres.name,
                            set: {
                                description: genre.description,
                                deletedAt: null,
                                updatedAt: new Date(),
                            },
                        })
                        .returning();
                }
            })
        );
        results.push(...batchResults.map(r => r[0]));
    }
    return results;
}

export async function seedBookGenres(db: PostgresJsDatabase<any>, bookGenresData: NewBookGenre[]): Promise<BookGenre[]> {
    const results: BookGenre[] = [];
    for (let i = 0; i < bookGenresData.length; i += BATCH_SIZE) {
        const batch = bookGenresData.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
            batch.map(async (bookGenre) => {
                const insertResult = await db.insert(bookGenres)
                    .values(bookGenre)
                    .onConflictDoNothing()
                    .returning();
                
                if (insertResult.length > 0) {
                    return insertResult;
                }
                
                const existing = await db.select()
                    .from(bookGenres)
                    .where(
                        and(
                            eq(bookGenres.bookId, bookGenre.bookId),
                            eq(bookGenres.genreId, bookGenre.genreId)
                        )
                    )
                    .limit(1);
                
                return existing;
            })
        );
        results.push(...batchResults.map(r => r[0]));
    }
    return results;
}

export async function setupSeedData(db: PostgresJsDatabase<any>): Promise<SeedData> {
    // Seed base data with explicit UUIDs for stability
    const seededAuthors = await seedAuthors(db, [
        { id: SEED_UUIDS.authors.johnDoe, name: "John Doe", email: "john@example.com" },
        { id: SEED_UUIDS.authors.janeSmith, name: "Jane Smith", email: "jane@example.com" },
        { id: SEED_UUIDS.authors.author1, name: "Author 1", email: null },
        { id: SEED_UUIDS.authors.author2, name: "Author 2", email: null },
        { id: SEED_UUIDS.authors.authorA, name: "Author A", email: null },
        { id: SEED_UUIDS.authors.authorB, name: "Author B", email: null },
        { id: SEED_UUIDS.authors.targetAuthor, name: "Target Author", email: null },
        { id: SEED_UUIDS.authors.otherAuthor, name: "Other Author", email: null },
        { id: SEED_UUIDS.authors.zebraAuthor, name: "Zebra Author", email: null },
        { id: SEED_UUIDS.authors.alphaAuthor, name: "Alpha Author", email: null },
    ]);

    const seededPublishers = await seedPublishers(db, [
        { id: SEED_UUIDS.publishers.techBooksInc, name: "Tech Books Inc", address: null },
        { id: SEED_UUIDS.publishers.publisherName, name: "Publisher Name", address: null },
        { id: SEED_UUIDS.publishers.targetPublisher, name: "Target Publisher", address: null },
        { id: SEED_UUIDS.publishers.otherPublisher, name: "Other Publisher", address: null },
        { id: SEED_UUIDS.publishers.zebraPublisher, name: "Zebra Publisher", address: null },
        { id: SEED_UUIDS.publishers.alphaPublisher, name: "Alpha Publisher", address: null },
    ]);

    const seededBooks = await seedBooks(db, [
        { id: SEED_UUIDS.books.book1, name: "Book 1", description: "First test book", authorId: null, publisherId: null },
        { id: SEED_UUIDS.books.book2, name: "Book 2", description: "Second test book", authorId: null, publisherId: null },
        { id: SEED_UUIDS.books.book3, name: "Book 3", description: "Third test book", authorId: null, publisherId: null },
        { id: SEED_UUIDS.books.book4, name: "Book 4", description: "Fourth test book", authorId: null, publisherId: null },
        { id: SEED_UUIDS.books.book5, name: "Book 5", description: "Fifth test book", authorId: null, publisherId: null },
        { id: SEED_UUIDS.books.javascriptGuide, name: "JavaScript Guide", description: "Learn JavaScript", authorId: null, publisherId: null },
        { id: SEED_UUIDS.books.pythonBasics, name: "Python Basics", description: "Python programming", authorId: null, publisherId: null },
        { id: SEED_UUIDS.books.typescriptAdvanced, name: "TypeScript Advanced", description: "Advanced TypeScript", authorId: null, publisherId: null },
        { id: SEED_UUIDS.books.bookA, name: "Book A", description: "Mathematics fundamentals", authorId: null, publisherId: null },
        { id: SEED_UUIDS.books.bookB, name: "Book B", description: "Physics concepts", authorId: null, publisherId: null },
        { id: SEED_UUIDS.books.bookC, name: "Book C", description: "Advanced mathematics", authorId: null, publisherId: null },
        { id: SEED_UUIDS.books.reactGuide, name: "React Guide", description: "Learn React", authorId: null, publisherId: null },
        { id: SEED_UUIDS.books.vueBasics, name: "Vue Basics", description: "React patterns", authorId: null, publisherId: null },
        { id: SEED_UUIDS.books.angularAdvanced, name: "Angular Advanced", description: "Framework comparison", authorId: null, publisherId: null },
        { id: SEED_UUIDS.books.nodejsGuide, name: "Node.js Guide", description: "Server-side JavaScript", authorId: null, publisherId: null },
        { id: SEED_UUIDS.books.expressFramework, name: "Express Framework", description: "Web framework", authorId: null, publisherId: null },
    ]);

    // Add programming books for pagination test (without explicit IDs - will be auto-generated)
    const programmingBooks = Array.from({ length: 15 }, (_, i) => ({
        name: `Programming Book ${i + 1}`,
        description: `Book about programming ${i + 1}`,
        authorId: null as string | null,
        publisherId: null as string | null,
    }));
    const seededProgrammingBooks = await seedBooks(db, programmingBooks);
    seededBooks.push(...seededProgrammingBooks);

    return {
        authors: seededAuthors,
        publishers: seededPublishers,
        books: seededBooks,
        bookDetails: [],
        genres: [],
        bookGenres: [],
    };
}

