import { assertEquals, assertExists, assertThrows } from "@std/assert";
import {
    toCamelCase,
    getTableName,
    inferRelationalQueryKey,
    validateId,
    sanitizeWithObject,
    inferRelationsFromSchema,
    mergeRelationOptions,
} from "../src/utils.ts";
import { books } from "./setup/schema.ts";

Deno.test({
    name: "Utils - toCamelCase",
    fn: async (t) => {
        await t.step("toCamelCase converts kebab-case", () => {
            const result = toCamelCase("test-case");
            assertEquals(result, "testCase");
        });

        await t.step("toCamelCase converts snake_case", () => {
            const result = toCamelCase("test_case");
            assertEquals(result, "testCase");
        });

        await t.step("toCamelCase handles multiple separators", () => {
            const result = toCamelCase("test-case_example");
            assertEquals(result, "testCaseExample");
        });

        await t.step("toCamelCase handles string without separators", () => {
            const result = toCamelCase("testcase");
            assertEquals(result, "testcase");
        });

        await t.step("toCamelCase handles empty string", () => {
            const result = toCamelCase("");
            assertEquals(result, "");
        });

        await t.step("toCamelCase handles string starting with separator", () => {
            const result = toCamelCase("-test-case");
            assertEquals(result, "TestCase");
        });

        await t.step("toCamelCase handles consecutive separators", () => {
            const result = toCamelCase("test--case");
            assertEquals(result, "test-Case");
        });
    },
});

Deno.test({
    name: "Utils - getTableName",
    fn: async (t) => {
        await t.step("getTableName extracts from Symbol.for('drizzle:Name')", () => {
            const mockTable = {
                [Symbol.for("drizzle:Name")]: "test_table",
            };
            const result = getTableName(mockTable);
            assertEquals(result, "test_table");
        });

        await t.step("getTableName extracts from tableName property", () => {
            const mockTable = {
                tableName: "test_table",
            };
            const result = getTableName(mockTable);
            assertEquals(result, "test_table");
        });

        await t.step("getTableName extracts from dbName property", () => {
            const mockTable = {
                dbName: "test_table",
            };
            const result = getTableName(mockTable);
            assertEquals(result, "test_table");
        });

        await t.step("getTableName extracts from _.name property", () => {
            const mockTable = {
                _: {
                    name: "test_table",
                },
            };
            const result = getTableName(mockTable);
            assertEquals(result, "test_table");
        });

        await t.step("getTableName extracts from name property", () => {
            const mockTable = {
                name: "test_table",
            };
            const result = getTableName(mockTable);
            assertEquals(result, "test_table");
        });

        await t.step("getTableName returns undefined for null", () => {
            const result = getTableName(null);
            assertEquals(result, undefined);
        });

        await t.step("getTableName returns undefined for undefined", () => {
            const result = getTableName(undefined);
            assertEquals(result, undefined);
        });

        await t.step("getTableName returns undefined for object without name properties", () => {
            const result = getTableName({});
            assertEquals(result, undefined);
        });

        await t.step("getTableName prioritizes Symbol over other properties", () => {
            const mockTable = {
                [Symbol.for("drizzle:Name")]: "symbol_name",
                tableName: "table_name",
                name: "name",
            };
            const result = getTableName(mockTable);
            assertEquals(result, "symbol_name");
        });

        await t.step("getTableName works with actual Drizzle table", () => {
            const result = getTableName(books);
            assertExists(result);
        });
    },
});

Deno.test({
    name: "Utils - inferRelationalQueryKey",
    fn: async (t) => {
        await t.step("inferRelationalQueryKey returns undefined for empty availableQueryKeys", () => {
            const result = inferRelationalQueryKey(books, []);
            assertEquals(result, undefined);
        });

        await t.step("inferRelationalQueryKey matches exact table name", () => {
            const result = inferRelationalQueryKey(books, ["books", "authors"]);
            assertEquals(result, "books");
        });

        await t.step("inferRelationalQueryKey matches camelCase table name", () => {
            const tableName = getTableName(books);
            if (tableName) {
                const camelCase = toCamelCase(tableName);
                const result = inferRelationalQueryKey(books, [camelCase, "authors"]);
                assertEquals(result, camelCase);
            }
        });

        await t.step("inferRelationalQueryKey matches singular form", () => {
            const tableName = getTableName(books);
            if (tableName) {
                const singular = tableName.replace(/s$/, "");
                const result = inferRelationalQueryKey(books, [singular, "authors"]);
                assertEquals(result, singular);
            }
        });

        await t.step("inferRelationalQueryKey matches camelCase singular form", () => {
            const tableName = getTableName(books);
            if (tableName) {
                const singular = tableName.replace(/s$/, "");
                const camelCaseSingular = toCamelCase(singular);
                const result = inferRelationalQueryKey(books, [camelCaseSingular, "authors"]);
                assertEquals(result, camelCaseSingular);
            }
        });

        await t.step("inferRelationalQueryKey matches case-insensitive", () => {
            const result = inferRelationalQueryKey(books, ["BOOKS", "authors"]);
            assertEquals(result, "BOOKS");
        });

        await t.step("inferRelationalQueryKey returns undefined when no match", () => {
            const result = inferRelationalQueryKey(books, ["other", "tables"]);
            assertEquals(result, undefined);
        });

        await t.step("inferRelationalQueryKey returns undefined for table without name", () => {
            const result = inferRelationalQueryKey({}, ["books"]);
            assertEquals(result, undefined);
        });

        await t.step("inferRelationalQueryKey handles table name that is not a string", () => {
            const mockTable = {
                [Symbol.for("drizzle:Name")]: 123,
            };
            const result = inferRelationalQueryKey(mockTable, ["books"]);
            assertEquals(result, undefined);
        });
    },
});

Deno.test({
    name: "Utils - validateId",
    fn: async (t) => {
        await t.step("validateId accepts valid string ID", () => {
            validateId("valid-id");
        });

        await t.step("validateId accepts valid number ID", () => {
            validateId(123);
        });

        await t.step("validateId throws for empty string", () => {
            assertThrows(
                () => validateId(""),
                Error,
            );
        });

        await t.step("validateId throws for whitespace-only string", () => {
            assertThrows(
                () => validateId("   "),
                Error,
            );
        });

        await t.step("validateId throws for NaN number", () => {
            assertThrows(
                () => validateId(NaN),
                Error,
            );
        });

        await t.step("validateId throws for zero", () => {
            assertThrows(
                () => validateId(0),
                Error,
            );
        });

        await t.step("validateId throws for negative number", () => {
            assertThrows(
                () => validateId(-1),
                Error,
            );
        });

        await t.step("validateId accepts positive number", () => {
            validateId(1);
        });

        await t.step("validateId accepts large number", () => {
            validateId(999999);
        });
    },
});

Deno.test({
    name: "Utils - sanitizeWithObject",
    fn: async (t) => {
        await t.step("sanitizeWithObject preserves true values", () => {
            const result = sanitizeWithObject({ author: true });
            assertEquals(result, { author: true });
        });

        await t.step("sanitizeWithObject removes false values", () => {
            const result = sanitizeWithObject({ author: false });
            assertEquals(result, {});
        });

        await t.step("sanitizeWithObject preserves object values", () => {
            const result = sanitizeWithObject({ author: { with: { books: true } } });
            assertEquals(result, { author: { with: { books: true } } });
        });

        await t.step("sanitizeWithObject handles nested true values", () => {
            const result = sanitizeWithObject({
                author: {
                    with: {
                        books: true,
                        publisher: true,
                    },
                },
            });
            assertEquals(result, {
                author: {
                    with: {
                        books: true,
                        publisher: true,
                    },
                },
            });
        });

        await t.step("sanitizeWithObject handles nested false values", () => {
            const result = sanitizeWithObject({
                author: {
                    with: {
                        books: false,
                    },
                },
            });
            assertEquals(result, {});
        });

        await t.step("sanitizeWithObject preserves non-boolean values", () => {
            const result = sanitizeWithObject({
                author: {
                    with: {
                        books: { limit: 10 },
                    },
                },
            });
            assertEquals(result, {
                author: {
                    with: {
                        books: { limit: 10 },
                    },
                },
            });
        });

        await t.step("sanitizeWithObject handles mixed values", () => {
            const result = sanitizeWithObject({
                author: true,
                publisher: false,
                books: { limit: 10 },
            });
            assertEquals(result, {
                author: true,
                books: { limit: 10 },
            });
        });

        await t.step("sanitizeWithObject returns empty object for null", () => {
            const result = sanitizeWithObject(null as any);
            assertEquals(result, {});
        });

        await t.step("sanitizeWithObject returns empty object for undefined", () => {
            const result = sanitizeWithObject(undefined as any);
            assertEquals(result, {});
        });

        await t.step("sanitizeWithObject returns empty object for non-object", () => {
            const result = sanitizeWithObject("string" as any);
            assertEquals(result, {});
        });

        await t.step("sanitizeWithObject handles empty object", () => {
            const result = sanitizeWithObject({});
            assertEquals(result, {});
        });

        await t.step("sanitizeWithObject handles array values", () => {
            const result = sanitizeWithObject({ items: [1, 2, 3] });
            assertEquals(result, { items: [1, 2, 3] });
        });

        await t.step("sanitizeWithObject handles deeply nested structures", () => {
            const result = sanitizeWithObject({
                author: {
                    with: {
                        books: {
                            with: {
                                publisher: true,
                            },
                        },
                    },
                },
            });
            assertEquals(result, {
                author: {
                    with: {
                        books: {
                            with: {
                                publisher: true,
                            },
                        },
                    },
                },
            });
        });
    },
});

Deno.test({
    name: "Utils - inferRelationsFromSchema - Foreign Key Detection",
    fn: async (t) => {
        await t.step("detects column ending with 'Id' with valid reference", () => {
            const mockReferencedTable = {
                [Symbol.for("drizzle:Name")]: "authors",
            };
            const mockAuthorIdColumn = {
                name: "authorId",
                reference: () => () => mockReferencedTable,
            };
            const mockTable = {
                [Symbol.for("drizzle:Name")]: "books",
                id: { name: "id" },
                authorId: mockAuthorIdColumn,
                name: { name: "name" },
            };
            const mockDb = {
                query: {
                    books: {
                        findMany: () => {},
                    },
                },
            };

            const result = inferRelationsFromSchema(mockDb, mockTable);

            assertEquals(result.relationTables.author, mockReferencedTable);
            assertEquals(result.relationForeignKeys.author, mockAuthorIdColumn);
        });

        await t.step("detects column ending with 'Id' where reference() throws", () => {
            const mockAuthorIdColumn = {
                name: "authorId",
                reference: () => {
                    throw new Error("Reference error");
                },
            };
            const mockTable = {
                [Symbol.for("drizzle:Name")]: "books",
                id: { name: "id" },
                authorId: mockAuthorIdColumn,
            };
            const mockDb = {
                query: {
                    books: {
                        findMany: () => {},
                    },
                },
            };

            const result = inferRelationsFromSchema(mockDb, mockTable);

            assertEquals(result.relationTables.author, undefined);
            assertEquals(result.relationForeignKeys.author, mockAuthorIdColumn);
        });

        await t.step("detects column ending with 'Id' where reference() returns undefined", () => {
            const mockAuthorIdColumn = {
                name: "authorId",
                reference: () => () => undefined,
            };
            const mockTable = {
                [Symbol.for("drizzle:Name")]: "books",
                id: { name: "id" },
                authorId: mockAuthorIdColumn,
            };
            const mockDb = {
                query: {
                    books: {
                        findMany: () => {},
                    },
                },
            };

            const result = inferRelationsFromSchema(mockDb, mockTable);

            assertEquals(result.relationTables.author, undefined);
            assertEquals(result.relationForeignKeys.author, undefined);
        });

        await t.step("skips column not ending with 'Id'", () => {
            const mockTable = {
                [Symbol.for("drizzle:Name")]: "books",
                id: { name: "id" },
                name: { name: "name" },
                description: { name: "description" },
            };
            const mockDb = {
                query: {
                    books: {
                        findMany: () => {},
                    },
                },
            };

            const result = inferRelationsFromSchema(mockDb, mockTable);

            assertEquals(Object.keys(result.relationTables).length, 0);
            assertEquals(Object.keys(result.relationForeignKeys).length, 0);
        });

        await t.step("skips column name exactly 'id'", () => {
            const mockTable = {
                [Symbol.for("drizzle:Name")]: "books",
                id: { name: "id" },
            };
            const mockDb = {
                query: {
                    books: {
                        findMany: () => {},
                    },
                },
            };

            const result = inferRelationsFromSchema(mockDb, mockTable);

            assertEquals(Object.keys(result.relationTables).length, 0);
            assertEquals(Object.keys(result.relationForeignKeys).length, 0);
        });

        await t.step("skips snake_case column ending with '_id' (case-sensitive check)", () => {
            const mockAuthorIdColumn = {
                name: "author_id",
                reference: () => () => ({ [Symbol.for("drizzle:Name")]: "authors" }),
            };
            const mockTable = {
                [Symbol.for("drizzle:Name")]: "books",
                id: { name: "id" },
                author_id: mockAuthorIdColumn,
            };
            const mockDb = {
                query: {
                    books: {
                        findMany: () => {},
                    },
                },
            };

            const result = inferRelationsFromSchema(mockDb, mockTable);

            assertEquals(result.relationTables.author, undefined);
            assertEquals(result.relationForeignKeys.author, undefined);
        });

        await t.step("skips kebab-case column ending with '-id' (case-sensitive check)", () => {
            const mockAuthorIdColumn = {
                name: "author-id",
                reference: () => () => ({ [Symbol.for("drizzle:Name")]: "authors" }),
            };
            const mockTable = {
                [Symbol.for("drizzle:Name")]: "books",
                id: { name: "id" },
                "author-id": mockAuthorIdColumn,
            };
            const mockDb = {
                query: {
                    books: {
                        findMany: () => {},
                    },
                },
            };

            const result = inferRelationsFromSchema(mockDb, mockTable);

            assertEquals(result.relationTables.author, undefined);
            assertEquals(result.relationForeignKeys.author, undefined);
        });

        await t.step("handles multiple foreign key columns", () => {
            const mockAuthorTable = {
                [Symbol.for("drizzle:Name")]: "authors",
            };
            const mockPublisherTable = {
                [Symbol.for("drizzle:Name")]: "publishers",
            };
            const mockAuthorIdColumn = {
                name: "authorId",
                reference: () => () => mockAuthorTable,
            };
            const mockPublisherIdColumn = {
                name: "publisherId",
                reference: () => () => mockPublisherTable,
            };
            const mockTable = {
                [Symbol.for("drizzle:Name")]: "books",
                id: { name: "id" },
                authorId: mockAuthorIdColumn,
                publisherId: mockPublisherIdColumn,
            };
            const mockDb = {
                query: {
                    books: {
                        findMany: () => {},
                    },
                },
            };

            const result = inferRelationsFromSchema(mockDb, mockTable);

            assertEquals(result.relationTables.author, mockAuthorTable);
            assertEquals(result.relationTables.publisher, mockPublisherTable);
            assertEquals(result.relationForeignKeys.author, mockAuthorIdColumn);
            assertEquals(result.relationForeignKeys.publisher, mockPublisherIdColumn);
        });

        await t.step("skips standard timestamp columns", () => {
            const mockTable = {
                [Symbol.for("drizzle:Name")]: "books",
                id: { name: "id" },
                createdAt: { name: "createdAt" },
                updatedAt: { name: "updatedAt" },
                deletedAt: { name: "deletedAt" },
            };
            const mockDb = {
                query: {
                    books: {
                        findMany: () => {},
                    },
                },
            };

            const result = inferRelationsFromSchema(mockDb, mockTable);

            assertEquals(Object.keys(result.relationTables).length, 0);
            assertEquals(Object.keys(result.relationForeignKeys).length, 0);
        });

        await t.step("handles column without name property using key", () => {
            const mockReferencedTable = {
                [Symbol.for("drizzle:Name")]: "authors",
            };
            const mockAuthorIdColumn = {
                reference: () => () => mockReferencedTable,
            };
            const mockTable = {
                [Symbol.for("drizzle:Name")]: "books",
                id: { name: "id" },
                authorId: mockAuthorIdColumn,
            };
            const mockDb = {
                query: {
                    books: {
                        findMany: () => {},
                    },
                },
            };

            const result = inferRelationsFromSchema(mockDb, mockTable);

            assertEquals(result.relationTables.author, mockReferencedTable);
            assertEquals(result.relationForeignKeys.author, mockAuthorIdColumn);
        });

        await t.step("handles column that is not an object", () => {
            const mockTable = {
                [Symbol.for("drizzle:Name")]: "books",
                id: { name: "id" },
                authorId: "not-an-object",
            };
            const mockDb = {
                query: {
                    books: {
                        findMany: () => {},
                    },
                },
            };

            const result = inferRelationsFromSchema(mockDb, mockTable);

            assertEquals(Object.keys(result.relationTables).length, 0);
            assertEquals(Object.keys(result.relationForeignKeys).length, 0);
        });

        await t.step("handles column where reference()() throws in catch block", () => {
            const mockAuthorIdColumn = {
                name: "authorId",
                reference: () => {
                    return () => {
                        throw new Error("Nested error");
                    };
                },
            };
            const mockTable = {
                [Symbol.for("drizzle:Name")]: "books",
                id: { name: "id" },
                authorId: mockAuthorIdColumn,
            };
            const mockDb = {
                query: {
                    books: {
                        findMany: () => {},
                    },
                },
            };

            const result = inferRelationsFromSchema(mockDb, mockTable);

            assertEquals(result.relationTables.author, undefined);
            assertEquals(result.relationForeignKeys.author, mockAuthorIdColumn);
        });
    },
});

Deno.test({
    name: "Utils - mergeRelationOptions - Deep Merge",
    fn: async (t) => {
        await t.step("merges both base and override objects with 'with' property", () => {
            const defaults = {
                author: {
                    with: {
                        books: true,
                        publisher: true,
                    },
                },
            };
            const overrides = {
                author: {
                    with: {
                        books: false,
                        genres: true,
                    },
                },
            };

            const result = mergeRelationOptions(defaults, overrides);

            assertEquals(result, {
                author: {
                    with: {
                        publisher: true,
                        genres: true,
                    },
                },
            });
        });

        await t.step("merges both base and override objects without 'with' property", () => {
            const defaults = {
                author: {
                    limit: 10,
                    offset: 0,
                },
            };
            const overrides = {
                author: {
                    limit: 20,
                    orderBy: "name",
                },
            };

            const result = mergeRelationOptions(defaults, overrides);

            assertEquals(result, {
                author: {
                    limit: 20,
                    offset: 0,
                    orderBy: "name",
                },
            });
        });

        await t.step("override object replaces base when base is not object", () => {
            const defaults = {
                author: true,
            };
            const overrides = {
                author: {
                    with: {
                        books: true,
                    },
                },
            };

            const result = mergeRelationOptions(defaults, overrides);

            assertEquals(result, {
                author: {
                    with: {
                        books: true,
                    },
                },
            });
        });

        await t.step("override primitive replaces base primitive", () => {
            const defaults = {
                author: true,
                publisher: false,
            };
            const overrides = {
                author: false,
                publisher: true,
            };

            const result = mergeRelationOptions(defaults, overrides);

            assertEquals(result, {
                publisher: true,
            });
        });

        await t.step("override primitive replaces base object", () => {
            const defaults = {
                author: {
                    with: {
                        books: true,
                    },
                },
            };
            const overrides = {
                author: true,
            };

            const result = mergeRelationOptions(defaults, overrides);

            assertEquals(result, {
                author: true,
            });
        });

        await t.step("handles nested deep merge with multiple levels", () => {
            const defaults = {
                author: {
                    with: {
                        books: {
                            with: {
                                publisher: true,
                            },
                        },
                    },
                },
            };
            const overrides = {
                author: {
                    with: {
                        books: {
                            with: {
                                genres: true,
                                publisher: false,
                            },
                        },
                    },
                },
            };

            const result = mergeRelationOptions(defaults, overrides);

            assertEquals(result, {
                author: {
                    with: {
                        books: {
                            with: {
                                genres: true,
                            },
                        },
                    },
                },
            });
        });

        await t.step("handles mixed scenarios with some deep merge and some not", () => {
            const defaults = {
                author: {
                    with: {
                        books: true,
                    },
                },
                publisher: true,
                genre: {
                    limit: 10,
                },
            };
            const overrides = {
                author: {
                    with: {
                        books: false,
                        publisher: true,
                    },
                },
                publisher: {
                    with: {
                        books: true,
                    },
                },
                genre: false,
            };

            const result = mergeRelationOptions(defaults, overrides);

            assertEquals(result, {
                author: {
                    with: {
                        publisher: true,
                    },
                },
                publisher: {
                    with: {
                        books: true,
                    },
                },
            });
        });

        await t.step("handles override with empty object when base is not object", () => {
            const defaults = {
                author: true,
            };
            const overrides = {
                author: {},
            };

            const result = mergeRelationOptions(defaults, overrides);

            assertEquals(result, {
                author: true,
            });
        });

        await t.step("handles override with empty object when base is object", () => {
            const defaults = {
                author: {
                    with: {
                        books: true,
                    },
                },
            };
            const overrides = {
                author: {},
            };

            const result = mergeRelationOptions(defaults, overrides);

            assertEquals(result, {
                author: {
                    with: {
                        books: true,
                    },
                },
            });
        });

        await t.step("handles array values in override", () => {
            const defaults = {
                author: {
                    orderBy: ["name", "id"],
                },
            };
            const overrides = {
                author: {
                    orderBy: ["id", "name"],
                },
            };

            const result = mergeRelationOptions(defaults, overrides);

            assertEquals(result, {
                author: {
                    orderBy: ["id", "name"],
                },
            });
        });

        await t.step("handles null and undefined values in override", () => {
            const defaults = {
                author: {
                    with: {
                        books: true,
                    },
                },
            };
            const overrides = {
                author: {
                    with: null,
                },
            };

            const result = mergeRelationOptions(defaults, overrides);

            assertEquals(result, {
                author: {
                    with: {
                        books: true,
                    },
                },
            });
        });

        await t.step("handles base with 'with' but override without 'with'", () => {
            const defaults = {
                author: {
                    with: {
                        books: true,
                    },
                    limit: 10,
                },
            };
            const overrides = {
                author: {
                    limit: 20,
                },
            };

            const result = mergeRelationOptions(defaults, overrides);

            assertEquals(result, {
                author: {
                    with: {
                        books: true,
                    },
                    limit: 20,
                },
            });
        });

        await t.step("handles base without 'with' but override with 'with'", () => {
            const defaults = {
                author: {
                    limit: 10,
                },
            };
            const overrides = {
                author: {
                    with: {
                        books: true,
                    },
                    limit: 20,
                },
            };

            const result = mergeRelationOptions(defaults, overrides);

            assertEquals(result, {
                author: {
                    limit: 20,
                    with: {
                        books: true,
                    },
                },
            });
        });
    },
});
