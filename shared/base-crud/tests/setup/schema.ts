import { pgSchema, text, timestamp, uuid, varchar, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// hardcode pg schema name to "test_base_service" for testing
const schema = pgSchema("test_base_service");

export const authors = schema.table("authors", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    email: varchar("email", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const publishers = schema.table("publishers", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    address: text("address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const books = schema.table("books", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    description: text("description"),
    tags: varchar("tags", { length: 100 }).array().default([]),
    authorId: uuid("author_id").references(() => authors.id),
    publisherId: uuid("publisher_id").references(() => publishers.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const bookDetails = schema.table("book_details", {
    id: uuid("id").defaultRandom().primaryKey(),
    bookId: uuid("book_id").notNull().references(() => books.id).unique(),
    isbn: varchar("isbn", { length: 50 }).unique(),
    pageCount: integer("page_count"),
    language: varchar("language", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const genres = schema.table("genres", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const bookGenres = schema.table("book_genres", {
    id: uuid("id").defaultRandom().primaryKey(),
    bookId: uuid("book_id").notNull().references(() => books.id),
    genreId: uuid("genre_id").notNull().references(() => genres.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const hardDeleteItems = schema.table("hard_delete_items", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const booksRelations = relations(books, ({ one, many: _many }) => ({
    author: one(authors, {
        fields: [books.authorId],
        references: [authors.id],
    }),
    publisher: one(publishers, {
        fields: [books.publisherId],
        references: [publishers.id],
    }),
    bookDetails: one(bookDetails, {
        fields: [books.id],
        references: [bookDetails.bookId],
    }),
    genres: _many(bookGenres),
}));

export const authorsRelations = relations(authors, ({ many: _many }) => ({
    books: _many(books),
}));

export const publishersRelations = relations(publishers, ({ many: _many }) => ({
    books: _many(books),
}));

export const bookDetailsRelations = relations(bookDetails, ({ one }) => ({
    book: one(books, {
        fields: [bookDetails.bookId],
        references: [books.id],
    }),
}));

export const genresRelations = relations(genres, ({ many: _many }) => ({
    books: _many(bookGenres),
}));

export const bookGenresRelations = relations(bookGenres, ({ one }) => ({
    book: one(books, {
        fields: [bookGenres.bookId],
        references: [books.id],
    }),
    genre: one(genres, {
        fields: [bookGenres.genreId],
        references: [genres.id],
    }),
}));

export type Author = typeof authors.$inferSelect;
export type NewAuthor = typeof authors.$inferInsert;
export type Publisher = typeof publishers.$inferSelect;
export type NewPublisher = typeof publishers.$inferInsert;
export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
export type BookDetail = typeof bookDetails.$inferSelect;
export type NewBookDetail = typeof bookDetails.$inferInsert;
export type Genre = typeof genres.$inferSelect;
export type NewGenre = typeof genres.$inferInsert;
export type BookGenre = typeof bookGenres.$inferSelect;
export type NewBookGenre = typeof bookGenres.$inferInsert;
export type HardDeleteItem = typeof hardDeleteItems.$inferSelect;
export type NewHardDeleteItem = typeof hardDeleteItems.$inferInsert;

// Export schema object for drizzle client
export const testSchema = {
    authors,
    publishers,
    books,
    bookDetails,
    genres,
    bookGenres,
    hardDeleteItems,
    booksRelations,
    authorsRelations,
    publishersRelations,
    bookDetailsRelations,
    genresRelations,
    bookGenresRelations,
};

