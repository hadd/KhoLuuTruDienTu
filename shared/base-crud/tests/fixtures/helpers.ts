import { t } from "elysia";
import { isNull } from "drizzle-orm";
import { createCrudService } from "../../src/baseService.ts";
import { authors, books, bookDetails, publishers, genres, bookGenres, hardDeleteItems } from "../setup/schema.ts";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// Elysia validation schemas for tests
export const createAuthorSchema = t.Object({
    name: t.String({ minLength: 1 }),
    email: t.Optional(t.String()),
});

export const updateAuthorSchema = t.Object({
    name: t.Optional(t.String({ minLength: 1 })),
    email: t.Optional(t.String()),
});

export const authorEntitySchema = t.Object({
    id: t.String(),
    name: t.String(),
    email: t.Union([t.String(), t.Null()]),
    createdAt: t.Any(),
    updatedAt: t.Any(),
    deletedAt: t.Union([t.Any(), t.Null()]),
});

export const createBookSchema = t.Object({
    name: t.String({ minLength: 1 }),
    description: t.Optional(t.String()),
    authorId: t.Optional(t.String()),
    publisherId: t.Optional(t.String()),
});

export const updateBookSchema = t.Object({
    name: t.Optional(t.String({ minLength: 1 })),
    description: t.Optional(t.String()),
    authorId: t.Optional(t.String()),
    publisherId: t.Optional(t.String()),
});

export const bookEntitySchema = t.Object({
    id: t.String(),
    name: t.String(),
    description: t.Union([t.String(), t.Null()]),
    authorId: t.Union([t.String(), t.Null()]),
    publisherId: t.Union([t.String(), t.Null()]),
    createdAt: t.Any(),
    updatedAt: t.Any(),
    deletedAt: t.Union([t.Any(), t.Null()]),
});

export const createGenreSchema = t.Object({
    name: t.String({ minLength: 1 }),
    description: t.Optional(t.String()),
});

export const updateGenreSchema = t.Object({
    name: t.Optional(t.String({ minLength: 1 })),
    description: t.Optional(t.String()),
});

export const genreEntitySchema = t.Object({
    id: t.String(),
    name: t.String(),
    description: t.Union([t.String(), t.Null()]),
    createdAt: t.Any(),
    updatedAt: t.Any(),
    deletedAt: t.Union([t.Any(), t.Null()]),
});

export function createBookService(db: PostgresJsDatabase<any>) {
    return createCrudService({
        db,
        table: books,
        createSchema: createBookSchema,
        updateSchema: updateBookSchema,
        entitySchema: bookEntitySchema,
        searchable: ["name", "description"],
    });
}

export function createBookServiceWithRelations(db: PostgresJsDatabase<any>) {
    return createCrudService({
        db,
        table: books,
        createSchema: createBookSchema,
        updateSchema: updateBookSchema,
        entitySchema: bookEntitySchema,
        searchable: ["name", "description"],
        relationTables: {
            author: authors,
            publisher: publishers,
            bookDetails: bookDetails,
            genres: bookGenres,
        },
        relationForeignKeys: {
            bookDetails: bookDetails.bookId,
            genres: bookGenres.bookId,
        },
        defaultWith: {
            author: true,
            publisher: true,
            bookDetails: true,
            genres: true,
        },
    });
}

export function createAuthorServiceWithRelations(db: PostgresJsDatabase<any>) {
    return createCrudService({
        db,
        table: authors,
        createSchema: createAuthorSchema,
        updateSchema: updateAuthorSchema,
        entitySchema: authorEntitySchema,
        searchable: ["name", "email"],
        relationTables: {
            books: books,
        },
        relationForeignKeys: {
            books: books.authorId,
        },
        defaultWith: {
            books: true,
        },
    });
}

export function createAuthorServiceWithDeepRelations(db: PostgresJsDatabase<any>) {
    return createCrudService({
        db,
        table: authors,
        createSchema: createAuthorSchema,
        updateSchema: updateAuthorSchema,
        entitySchema: authorEntitySchema,
        searchable: ["name", "email"],
        relationTables: {
            books: books,
            bookDetails: bookDetails,
        },
        relationForeignKeys: {
            books: books.authorId,
            bookDetails: bookDetails.bookId,
        },
        defaultWith: {
            books: {
                bookDetails: true,
            },
        },
    });
}

export function createGenreServiceWithRelations(db: PostgresJsDatabase<any>) {
    return createCrudService({
        db,
        table: genres,
        createSchema: createGenreSchema,
        updateSchema: updateGenreSchema,
        entitySchema: genreEntitySchema,
        searchable: ["name", "description"],
        relationTables: {
            books: bookGenres,
        },
        relationForeignKeys: {
            books: bookGenres.genreId,
        },
        defaultWith: {
            books: true,
        },
    });
}

export function createBookServiceWithMapRecord(db: PostgresJsDatabase<any>) {
    return createCrudService({
        db,
        table: books,
        createSchema: createBookSchema,
        updateSchema: updateBookSchema,
        entitySchema: bookEntitySchema,
        searchable: ["name", "description"],
        mapRecord: (rows) => {
            return rows.map((row: any) => ({
                ...row,
                mapped: true,
            }));
        },
    });
}

export function createBookServiceWithMapRecordAndRelations(db: PostgresJsDatabase<any>) {
    return createCrudService({
        db,
        table: books,
        createSchema: createBookSchema,
        updateSchema: updateBookSchema,
        entitySchema: bookEntitySchema,
        searchable: ["name", "description"],
        relationTables: {
            author: authors,
            publisher: publishers,
        },
        defaultWith: {
            author: true,
            publisher: true,
        },
        mapRecord: (rows) => {
            return rows.map((row: any) => ({
                ...row,
                mapped: true,
            }));
        },
    });
}

export function createBookServiceWithRelationSearch(db: PostgresJsDatabase<any>) {
    return createCrudService({
        db,
        table: books,
        createSchema: createBookSchema,
        updateSchema: updateBookSchema,
        entitySchema: bookEntitySchema,
        searchable: ["name", "description"],
        relationTables: {
            author: authors,
            publisher: publishers,
        },
        relationSearchable: {
            author: ["name", "email"],
            publisher: ["name"],
        },
        defaultWith: {
            author: true,
            publisher: true,
        },
    });
}

export const createHardDeleteTableSchema = t.Object({
    name: t.String({ minLength: 1 }),
    description: t.Optional(t.String()),
});

export const updateHardDeleteTableSchema = t.Object({
    name: t.Optional(t.String({ minLength: 1 })),
    description: t.Optional(t.String()),
});


export function createBookServiceWithRestrictQuery(db: PostgresJsDatabase<any>) {
    return createCrudService({
        db,
        table: books,
        createSchema: createBookSchema,
        updateSchema: updateBookSchema,
        entitySchema: bookEntitySchema,
        searchable: ["name", "description"],
        restrictServiceQuery: () => isNull(books.deletedAt),
    });
}

export function createBookServiceWithMapRecordForGet(db: PostgresJsDatabase<any>) {
    return createCrudService({
        db,
        table: books,
        createSchema: createBookSchema,
        updateSchema: updateBookSchema,
        entitySchema: bookEntitySchema,
        searchable: ["name", "description"],
        mapRecord: (rows) => {
            return rows.map((row: any) => ({
                ...row,
                mapped: true,
            }));
        },
    });
}

export const hardDeleteItemEntitySchema = t.Object({
    id: t.String(),
    name: t.String(),
    description: t.Union([t.String(), t.Null()]),
    createdAt: t.Any(),
    updatedAt: t.Any(),
});

export function createHardDeleteItemService(db: PostgresJsDatabase<any>) {
    return createCrudService({
        db,
        table: hardDeleteItems,
        createSchema: createHardDeleteTableSchema,
        updateSchema: updateHardDeleteTableSchema,
        entitySchema: hardDeleteItemEntitySchema,
        searchable: ["name", "description"],
    });
}

