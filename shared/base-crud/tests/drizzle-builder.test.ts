import { assertEquals, assertExists } from "@std/assert";
import { eq } from "drizzle-orm";
import { setupTestDatabase, closeTestDb, TEST_OPTS } from "./setup/utils.ts";
import { DrizzleBuilder, type QueryContext } from "../src/drizzle-builder.ts";
import { books, authors, publishers, bookDetails } from "./setup/schema.ts";
import type { FilterNode, FilterCondition, SortItem } from "../src/query.ts";

Deno.test.beforeAll(async () => {
    await setupTestDatabase();
});

Deno.test.afterAll(async () => {
    await closeTestDb();
});

Deno.test({
    name: "DrizzleBuilder - buildWhere",
    ...TEST_OPTS,
    fn: async (t) => {
        const ctx: QueryContext = {
            table: books,
            searchable: ["name", "description"],
        };

        await t.step("buildWhere with no filters returns extraFilters only", async () => {
            const extraFilter = eq(books.id, "00000000-0000-0000-0000-000000000001");
            const result = DrizzleBuilder.buildWhere(ctx, undefined, undefined, [extraFilter]);
            
            assertEquals(result.length, 1);
        });

        await t.step("buildWhere with search and single searchable field", async () => {
            const singleSearchCtx: QueryContext = {
                table: books,
                searchable: ["name"],
            };
            const result = DrizzleBuilder.buildWhere(singleSearchCtx, undefined, "test", []);
            
            assertEquals(result.length, 1);
        });

        await t.step("buildWhere with search and multiple searchable fields", async () => {
            const result = DrizzleBuilder.buildWhere(ctx, undefined, "test", []);
            
            assertEquals(result.length, 1);
        });

        await t.step("buildWhere with empty search string", async () => {
            const result = DrizzleBuilder.buildWhere(ctx, undefined, "", []);
            
            assertEquals(result.length, 0);
        });

        await t.step("buildWhere with whitespace-only search", async () => {
            const result = DrizzleBuilder.buildWhere(ctx, undefined, "   ", []);
            
            assertEquals(result.length, 0);
        });

        await t.step("buildWhere with no searchable fields", async () => {
            const noSearchCtx: QueryContext = {
                table: books,
                searchable: [],
            };
            const result = DrizzleBuilder.buildWhere(noSearchCtx, undefined, "test", []);
            
            assertEquals(result.length, 0);
        });

        await t.step("buildWhere with undefined searchable", async () => {
            const noSearchCtx: QueryContext = {
                table: books,
            };
            const result = DrizzleBuilder.buildWhere(noSearchCtx, undefined, "test", []);
            
            assertEquals(result.length, 0);
        });

        await t.step("buildWhere with filter only", async () => {
            const filter: FilterCondition = {
                field: "name",
                op: "$eq",
                value: "Test Book",
            };
            const result = DrizzleBuilder.buildWhere(ctx, filter, undefined, []);
            
            assertEquals(result.length, 1);
        });

        await t.step("buildWhere with filter and search", async () => {
            const filter: FilterCondition = {
                field: "name",
                op: "$eq",
                value: "Test Book",
            };
            const result = DrizzleBuilder.buildWhere(ctx, filter, "test", []);
            
            assertEquals(result.length, 2);
        });

        await t.step("buildWhere with filter, search, and extraFilters", async () => {
            const filter: FilterCondition = {
                field: "name",
                op: "$eq",
                value: "Test Book",
            };
            const extraFilter = eq(books.id, "00000000-0000-0000-0000-000000000001");
            const result = DrizzleBuilder.buildWhere(ctx, filter, "test", [extraFilter]);
            
            assertEquals(result.length, 3);
        });

        await t.step("buildWhere with searchable field that doesn't exist in table", async () => {
            const invalidSearchCtx: QueryContext = {
                table: books,
                searchable: ["nonexistent"],
            };
            const result = DrizzleBuilder.buildWhere(invalidSearchCtx, undefined, "test", []);
            
            assertEquals(result.length, 0);
        });

        await t.step("buildWhere with array column in searchable fields", async () => {
            const arraySearchCtx: QueryContext = {
                table: books,
                searchable: ["tags"],
                arrayFields: new Set(["tags"]),
            };
            const result = DrizzleBuilder.buildWhere(arraySearchCtx, undefined, "test", []);
            
            assertEquals(result.length, 1);
        });

        await t.step("buildWhere with mixed array and non-array columns", async () => {
            const mixedSearchCtx: QueryContext = {
                table: books,
                searchable: ["name", "tags"],
                arrayFields: new Set(["tags"]),
            };
            const result = DrizzleBuilder.buildWhere(mixedSearchCtx, undefined, "test", []);
            
            assertEquals(result.length, 1);
        });

        await t.step("buildWhere with array column works without index", async () => {
            const arraySearchCtx: QueryContext = {
                table: books,
                searchable: ["tags"],
                arrayFields: new Set(["tags"]),
            };
            const result = DrizzleBuilder.buildWhere(arraySearchCtx, undefined, "search", []);
            
            assertEquals(result.length, 1);
        });
    },
});

Deno.test({
    name: "DrizzleBuilder - buildWhere with Relation Search",
    ...TEST_OPTS,
    fn: async (t) => {
        await t.step("buildWhere with relation search - single relation field", async () => {
            const ctx: QueryContext = {
                table: books,
                searchable: ["name"],
                relationTables: {
                    author: authors,
                },
                relationSearchable: {
                    author: ["name"],
                },
            };
            const result = DrizzleBuilder.buildWhere(ctx, undefined, "test", []);
            
            assertEquals(result.length, 1);
        });

        await t.step("buildWhere with relation search - multiple relation fields", async () => {
            const ctx: QueryContext = {
                table: books,
                searchable: ["name"],
                relationTables: {
                    author: authors,
                },
                relationSearchable: {
                    author: ["name", "email"],
                },
            };
            const result = DrizzleBuilder.buildWhere(ctx, undefined, "test", []);
            
            assertEquals(result.length, 1);
        });

        await t.step("buildWhere with relation search - multiple relations", async () => {
            const ctx: QueryContext = {
                table: books,
                searchable: ["name"],
                relationTables: {
                    author: authors,
                    publisher: publishers,
                },
                relationSearchable: {
                    author: ["name"],
                    publisher: ["name"],
                },
            };
            const result = DrizzleBuilder.buildWhere(ctx, undefined, "test", []);
            
            assertEquals(result.length, 1);
        });

        await t.step("buildWhere with main table + relation search", async () => {
            const ctx: QueryContext = {
                table: books,
                searchable: ["name", "description"],
                relationTables: {
                    author: authors,
                },
                relationSearchable: {
                    author: ["name"],
                },
            };
            const result = DrizzleBuilder.buildWhere(ctx, undefined, "test", []);
            
            assertEquals(result.length, 1);
        });

        await t.step("buildWhere with relation search but no relationTables configured", async () => {
            const ctx: QueryContext = {
                table: books,
                searchable: ["name"],
                relationSearchable: {
                    author: ["name"],
                },
            };
            const result = DrizzleBuilder.buildWhere(ctx, undefined, "test", []);
            
            assertEquals(result.length, 1);
        });

        await t.step("buildWhere with relation search - invalid relation name", async () => {
            const ctx: QueryContext = {
                table: books,
                searchable: ["name"],
                relationTables: {
                    author: authors,
                },
                relationSearchable: {
                    invalidRelation: ["name"],
                },
            };
            const result = DrizzleBuilder.buildWhere(ctx, undefined, "test", []);
            
            assertEquals(result.length, 1);
        });

        await t.step("buildWhere with relation search - invalid field name", async () => {
            const ctx: QueryContext = {
                table: books,
                searchable: ["name"],
                relationTables: {
                    author: authors,
                },
                relationSearchable: {
                    author: ["invalidField"],
                },
            };
            const result = DrizzleBuilder.buildWhere(ctx, undefined, "test", []);
            
            assertEquals(result.length, 1);
        });

        await t.step("buildWhere with empty relationSearchable", async () => {
            const ctx: QueryContext = {
                table: books,
                searchable: ["name"],
                relationTables: {
                    author: authors,
                },
                relationSearchable: {},
            };
            const result = DrizzleBuilder.buildWhere(ctx, undefined, "test", []);
            
            assertEquals(result.length, 1);
        });

        await t.step("buildWhere with relation search but empty search term", async () => {
            const ctx: QueryContext = {
                table: books,
                searchable: ["name"],
                relationTables: {
                    author: authors,
                },
                relationSearchable: {
                    author: ["name"],
                },
            };
            const result = DrizzleBuilder.buildWhere(ctx, undefined, "", []);
            
            assertEquals(result.length, 0);
        });

        await t.step("buildWhere with relation search but whitespace-only search", async () => {
            const ctx: QueryContext = {
                table: books,
                searchable: ["name"],
                relationTables: {
                    author: authors,
                },
                relationSearchable: {
                    author: ["name"],
                },
            };
            const result = DrizzleBuilder.buildWhere(ctx, undefined, "   ", []);
            
            assertEquals(result.length, 0);
        });
    },
});

Deno.test({
    name: "DrizzleBuilder - searchNeedsJoins",
    ...TEST_OPTS,
    fn: async (t) => {
        await t.step("searchNeedsJoins with undefined search returns false", async () => {
            const ctx: QueryContext = {
                table: books,
                relationSearchable: {
                    author: ["name"],
                },
                relationTables: {
                    author: authors,
                },
            };
            const result = DrizzleBuilder.searchNeedsJoins(ctx, undefined);
            
            assertEquals(result, false);
        });

        await t.step("searchNeedsJoins with empty search returns false", async () => {
            const ctx: QueryContext = {
                table: books,
                relationSearchable: {
                    author: ["name"],
                },
                relationTables: {
                    author: authors,
                },
            };
            const result = DrizzleBuilder.searchNeedsJoins(ctx, "");
            
            assertEquals(result, false);
        });

        await t.step("searchNeedsJoins with whitespace-only search returns false", async () => {
            const ctx: QueryContext = {
                table: books,
                relationSearchable: {
                    author: ["name"],
                },
                relationTables: {
                    author: authors,
                },
            };
            const result = DrizzleBuilder.searchNeedsJoins(ctx, "   ");
            
            assertEquals(result, false);
        });

        await t.step("searchNeedsJoins with relation search configured returns true", async () => {
            const ctx: QueryContext = {
                table: books,
                relationSearchable: {
                    author: ["name"],
                },
                relationTables: {
                    author: authors,
                },
            };
            const result = DrizzleBuilder.searchNeedsJoins(ctx, "test");
            
            assertEquals(result, true);
        });

        await t.step("searchNeedsJoins without relationSearchable returns false", async () => {
            const ctx: QueryContext = {
                table: books,
                relationTables: {
                    author: authors,
                },
            };
            const result = DrizzleBuilder.searchNeedsJoins(ctx, "test");
            
            assertEquals(result, false);
        });

        await t.step("searchNeedsJoins without relationTables returns false", async () => {
            const ctx: QueryContext = {
                table: books,
                relationSearchable: {
                    author: ["name"],
                },
            };
            const result = DrizzleBuilder.searchNeedsJoins(ctx, "test");
            
            assertEquals(result, false);
        });

        await t.step("searchNeedsJoins with invalid relation name returns false", async () => {
            const ctx: QueryContext = {
                table: books,
                relationSearchable: {
                    invalidRelation: ["name"],
                },
                relationTables: {
                    author: authors,
                },
            };
            const result = DrizzleBuilder.searchNeedsJoins(ctx, "test");
            
            assertEquals(result, false);
        });
    },
});

Deno.test({
    name: "DrizzleBuilder - applyFilter",
    ...TEST_OPTS,
    fn: async (t) => {
        const ctx: QueryContext = {
            table: books,
        };

        await t.step("applyFilter with $eq operator", async () => {
            const filter: FilterCondition = {
                field: "name",
                op: "$eq",
                value: "Test Book",
            };
            const result = DrizzleBuilder.applyFilter(ctx, filter);
            
            assertExists(result);
        });

        await t.step("applyFilter with $in operator and non-empty array", async () => {
            const filter: FilterCondition = {
                field: "id",
                op: "$in",
                value: ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002", "00000000-0000-0000-0000-000000000003"],
            };
            const result = DrizzleBuilder.applyFilter(ctx, filter);
            
            assertExists(result);
        });

        await t.step("applyFilter with $in operator and empty array", async () => {
            const filter: FilterCondition = {
                field: "id",
                op: "$in",
                value: [],
            };
            const result = DrizzleBuilder.applyFilter(ctx, filter);
            
            assertExists(result);
        });

        await t.step("applyFilter with $nin operator and non-empty array", async () => {
            const filter: FilterCondition = {
                field: "id",
                op: "$nin",
                value: ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002", "00000000-0000-0000-0000-000000000003"],
            };
            const result = DrizzleBuilder.applyFilter(ctx, filter);
            
            assertExists(result);
        });

        await t.step("applyFilter with $nin operator and empty array", async () => {
            const filter: FilterCondition = {
                field: "id",
                op: "$nin",
                value: [],
            };
            const result = DrizzleBuilder.applyFilter(ctx, filter);
            
            assertExists(result);
        });

        await t.step("applyFilter with $gte operator", async () => {
            const filter: FilterCondition = {
                field: "id",
                op: "$gte",
                value: "00000000-0000-0000-0000-000000000005",
            };
            const result = DrizzleBuilder.applyFilter(ctx, filter);
            
            assertExists(result);
        });

        await t.step("applyFilter with $lte operator", async () => {
            const filter: FilterCondition = {
                field: "id",
                op: "$lte",
                value: "00000000-0000-0000-0000-000000000010",
            };
            const result = DrizzleBuilder.applyFilter(ctx, filter);
            
            assertExists(result);
        });

        await t.step("applyFilter with $gt operator", async () => {
            const filter: FilterCondition = {
                field: "id",
                op: "$gt",
                value: "00000000-0000-0000-0000-000000000005",
            };
            const result = DrizzleBuilder.applyFilter(ctx, filter);
            
            assertExists(result);
        });

        await t.step("applyFilter with $lt operator", async () => {
            const filter: FilterCondition = {
                field: "id",
                op: "$lt",
                value: "00000000-0000-0000-0000-000000000010",
            };
            const result = DrizzleBuilder.applyFilter(ctx, filter);
            
            assertExists(result);
        });

        await t.step("applyFilter with unknown operator returns default", async () => {
            const filter: FilterCondition = {
                field: "id",
                op: "$unknown" as any,
                value: "00000000-0000-0000-0000-000000000010",
            };
            const result = DrizzleBuilder.applyFilter(ctx, filter);
            
            assertExists(result);
        });

        await t.step("applyFilter with non-existent field returns default", async () => {
            const filter: FilterCondition = {
                field: "nonexistent",
                op: "$eq",
                value: "test",
            };
            const result = DrizzleBuilder.applyFilter(ctx, filter);
            
            assertExists(result);
        });

        await t.step("applyFilter with relation field", async () => {
            const relationCtx: QueryContext = {
                table: books,
                relationTables: {
                    author: authors,
                },
            };
            const filter: FilterCondition = {
                field: "author.name",
                op: "$eq",
                value: "Test Author",
                relation: "author",
                relationField: "name",
            };
            const result = DrizzleBuilder.applyFilter(relationCtx, filter);
            
            assertExists(result);
        });

        await t.step("applyFilter with relation field but no relationTables", async () => {
            const filter: FilterCondition = {
                field: "author.name",
                op: "$eq",
                value: "Test Author",
                relation: "author",
                relationField: "name",
            };
            const result = DrizzleBuilder.applyFilter(ctx, filter);
            
            assertExists(result);
        });

        await t.step("applyFilter with $and logical group", async () => {
            const filter: FilterNode = {
                $and: [
                    { field: "name", op: "$eq", value: "Test" },
                    { field: "id", op: "$gt", value: "00000000-0000-0000-0000-000000000000" },
                ],
            };
            const result = DrizzleBuilder.applyFilter(ctx, filter);
            
            assertExists(result);
        });

        await t.step("applyFilter with $or logical group", async () => {
            const filter: FilterNode = {
                $or: [
                    { field: "name", op: "$eq", value: "Test" },
                    { field: "id", op: "$gt", value: "00000000-0000-0000-0000-000000000000" },
                ],
            };
            const result = DrizzleBuilder.applyFilter(ctx, filter);
            
            assertExists(result);
        });

        await t.step("applyFilter with nested $and groups", async () => {
            const filter: FilterNode = {
                $and: [
                    { field: "name", op: "$eq", value: "Test" },
                    {
                        $and: [
                            { field: "id", op: "$gt", value: "00000000-0000-0000-0000-000000000000" },
                            { field: "id", op: "$lt", value: "00000000-0000-0000-0000-000000000100" },
                        ],
                    },
                ],
            };
            const result = DrizzleBuilder.applyFilter(ctx, filter);
            
            assertExists(result);
        });

        await t.step("applyFilter with nested $or groups", async () => {
            const filter: FilterNode = {
                $or: [
                    { field: "name", op: "$eq", value: "Test" },
                    {
                        $or: [
                            { field: "id", op: "$gt", value: "00000000-0000-0000-0000-000000000000" },
                            { field: "id", op: "$lt", value: "00000000-0000-0000-0000-000000000100" },
                        ],
                    },
                ],
            };
            const result = DrizzleBuilder.applyFilter(ctx, filter);
            
            assertExists(result);
        });

        await t.step("applyFilter with empty $and group", async () => {
            const filter: FilterNode = {
                $and: [],
            };
            const result = DrizzleBuilder.applyFilter(ctx, filter);
            assertEquals(result, undefined);
        });

        await t.step("applyFilter with empty $or group", async () => {
            const filter: FilterNode = {
                $or: [],
            };
            const result = DrizzleBuilder.applyFilter(ctx, filter);
            
            assertEquals(result, undefined);
        });
    },
});

Deno.test({
    name: "DrizzleBuilder - buildOrderBy",
    ...TEST_OPTS,
    fn: async (t) => {
        const ctx: QueryContext = {
            table: books,
        };

        await t.step("buildOrderBy with no sort and no defaultCreatedAt", async () => {
            const result = DrizzleBuilder.buildOrderBy(ctx, undefined, undefined);
            
            assertEquals(result.length, 0);
        });

        await t.step("buildOrderBy with no sort but with defaultCreatedAt", async () => {
            const result = DrizzleBuilder.buildOrderBy(ctx, undefined, books.createdAt);
            
            assertEquals(result.length, 1);
        });

        await t.step("buildOrderBy with empty sort array and defaultCreatedAt", async () => {
            const result = DrizzleBuilder.buildOrderBy(ctx, [], books.createdAt);
            
            assertEquals(result.length, 1);
        });

        await t.step("buildOrderBy with single sort asc", async () => {
            const sort: SortItem[] = [
                { field: "name", direction: "asc" },
            ];
            const result = DrizzleBuilder.buildOrderBy(ctx, sort, undefined);
            
            assertEquals(result.length, 1);
        });

        await t.step("buildOrderBy with single sort desc", async () => {
            const sort: SortItem[] = [
                { field: "name", direction: "desc" },
            ];
            const result = DrizzleBuilder.buildOrderBy(ctx, sort, undefined);
            
            assertEquals(result.length, 1);
        });

        await t.step("buildOrderBy with multiple sorts", async () => {
            const sort: SortItem[] = [
                { field: "name", direction: "asc" },
                { field: "id", direction: "desc" },
            ];
            const result = DrizzleBuilder.buildOrderBy(ctx, sort, undefined);
            
            assertEquals(result.length, 2);
        });

        await t.step("buildOrderBy with non-existent field", async () => {
            const sort: SortItem[] = [
                { field: "nonexistent", direction: "asc" },
            ];
            const result = DrizzleBuilder.buildOrderBy(ctx, sort, undefined);
            
            assertEquals(result.length, 0);
        });

        await t.step("buildOrderBy with non-existent field falls back to defaultCreatedAt", async () => {
            const sort: SortItem[] = [
                { field: "nonexistent", direction: "asc" },
            ];
            const result = DrizzleBuilder.buildOrderBy(ctx, sort, books.createdAt);
            
            assertEquals(result.length, 1);
        });

        await t.step("buildOrderBy with relation field", async () => {
            const relationCtx: QueryContext = {
                table: books,
                relationTables: {
                    author: authors,
                },
            };
            const sort: SortItem[] = [
                { field: "author.name", direction: "asc", relation: "author", relationField: "name" },
            ];
            const result = DrizzleBuilder.buildOrderBy(relationCtx, sort, undefined);
            
            assertEquals(result.length, 1);
        });

        await t.step("buildOrderBy with relation field but no relationTables", async () => {
            const sort: SortItem[] = [
                { field: "author.name", direction: "asc", relation: "author", relationField: "name" },
            ];
            const result = DrizzleBuilder.buildOrderBy(ctx, sort, undefined);
            
            assertEquals(result.length, 0);
        });

        await t.step("buildOrderBy with relation field but relation not in relationTables", async () => {
            const relationCtx: QueryContext = {
                table: books,
                relationTables: {
                    publisher: publishers,
                },
            };
            const sort: SortItem[] = [
                { field: "author.name", direction: "asc", relation: "author", relationField: "name" },
            ];
            const result = DrizzleBuilder.buildOrderBy(relationCtx, sort, undefined);
            
            assertEquals(result.length, 0);
        });

        await t.step("buildOrderBy with mix of valid and invalid fields", async () => {
            const sort: SortItem[] = [
                { field: "name", direction: "asc" },
                { field: "nonexistent", direction: "desc" },
                { field: "id", direction: "asc" },
            ];
            const result = DrizzleBuilder.buildOrderBy(ctx, sort, undefined);
            
            assertEquals(result.length, 2);
        });
    },
});

Deno.test({
    name: "DrizzleBuilder - needsJoins",
    ...TEST_OPTS,
    fn: async (t) => {
        await t.step("needsJoins with undefined node returns false", async () => {
            const result = DrizzleBuilder.needsJoins(undefined);
            
            assertEquals(result, false);
        });

        await t.step("needsJoins with simple filter without relation returns false", async () => {
            const filter: FilterCondition = {
                field: "name",
                op: "$eq",
                value: "Test",
            };
            const result = DrizzleBuilder.needsJoins(filter);
            
            assertEquals(result, false);
        });

        await t.step("needsJoins with filter with relation returns true", async () => {
            const filter: FilterCondition = {
                field: "author.name",
                op: "$eq",
                value: "Test",
                relation: "author",
                relationField: "name",
            };
            const result = DrizzleBuilder.needsJoins(filter);
            
            assertEquals(result, true);
        });

        await t.step("needsJoins with $and group without relations returns false", async () => {
            const filter: FilterNode = {
                $and: [
                    { field: "name", op: "$eq", value: "Test" },
                    { field: "id", op: "$gt", value: "00000000-0000-0000-0000-000000000000" },
                ],
            };
            const result = DrizzleBuilder.needsJoins(filter);
            
            assertEquals(result, false);
        });

        await t.step("needsJoins with $and group with relation returns true", async () => {
            const filter: FilterNode = {
                $and: [
                    { field: "name", op: "$eq", value: "Test" },
                    { field: "author.name", op: "$eq", value: "Author", relation: "author", relationField: "name" },
                ],
            };
            const result = DrizzleBuilder.needsJoins(filter);
            
            assertEquals(result, true);
        });

        await t.step("needsJoins with $or group without relations returns false", async () => {
            const filter: FilterNode = {
                $or: [
                    { field: "name", op: "$eq", value: "Test" },
                    { field: "id", op: "$gt", value: "00000000-0000-0000-0000-000000000000" },
                ],
            };
            const result = DrizzleBuilder.needsJoins(filter);
            
            assertEquals(result, false);
        });

        await t.step("needsJoins with $or group with relation returns true", async () => {
            const filter: FilterNode = {
                $or: [
                    { field: "name", op: "$eq", value: "Test" },
                    { field: "author.name", op: "$eq", value: "Author", relation: "author", relationField: "name" },
                ],
            };
            const result = DrizzleBuilder.needsJoins(filter);
            
            assertEquals(result, true);
        });

        await t.step("needsJoins with nested $and groups with relation returns true", async () => {
            const filter: FilterNode = {
                $and: [
                    { field: "name", op: "$eq", value: "Test" },
                    {
                        $and: [
                            { field: "id", op: "$gt", value: "00000000-0000-0000-0000-000000000000" },
                            { field: "author.name", op: "$eq", value: "Author", relation: "author", relationField: "name" },
                        ],
                    },
                ],
            };
            const result = DrizzleBuilder.needsJoins(filter);
            
            assertEquals(result, true);
        });

        await t.step("needsJoins with empty $and group returns false", async () => {
            const filter: FilterNode = {
                $and: [],
            };
            const result = DrizzleBuilder.needsJoins(filter);
            
            assertEquals(result, false);
        });

        await t.step("needsJoins with empty $or group returns false", async () => {
            const filter: FilterNode = {
                $or: [],
            };
            const result = DrizzleBuilder.needsJoins(filter);
            
            assertEquals(result, false);
        });
    },
});

Deno.test({
    name: "DrizzleBuilder - sortNeedsJoins",
    ...TEST_OPTS,
    fn: async (t) => {
        await t.step("sortNeedsJoins with undefined sort returns false", async () => {
            const result = DrizzleBuilder.sortNeedsJoins(undefined);
            
            assertEquals(result, false);
        });

        await t.step("sortNeedsJoins with empty sort array returns false", async () => {
            const result = DrizzleBuilder.sortNeedsJoins([]);
            
            assertEquals(result, false);
        });

        await t.step("sortNeedsJoins with sort without relation returns false", async () => {
            const sort: SortItem[] = [
                { field: "name", direction: "asc" },
            ];
            const result = DrizzleBuilder.sortNeedsJoins(sort);
            
            assertEquals(result, false);
        });

        await t.step("sortNeedsJoins with sort with relation returns true", async () => {
            const sort: SortItem[] = [
                { field: "author.name", direction: "asc", relation: "author", relationField: "name" },
            ];
            const result = DrizzleBuilder.sortNeedsJoins(sort);
            
            assertEquals(result, true);
        });

        await t.step("sortNeedsJoins with multiple sorts where one has relation returns true", async () => {
            const sort: SortItem[] = [
                { field: "name", direction: "asc" },
                { field: "author.name", direction: "desc", relation: "author", relationField: "name" },
            ];
            const result = DrizzleBuilder.sortNeedsJoins(sort);
            
            assertEquals(result, true);
        });

        await t.step("sortNeedsJoins with multiple sorts without relations returns false", async () => {
            const sort: SortItem[] = [
                { field: "name", direction: "asc" },
                { field: "id", direction: "desc" },
            ];
            const result = DrizzleBuilder.sortNeedsJoins(sort);
            
            assertEquals(result, false);
        });
    },
});

Deno.test({
    name: "DrizzleBuilder - resolveDeepPath",
    ...TEST_OPTS,
    fn: async (t) => {
        const ctx: QueryContext = {
            table: books,
            relationTables: {
                bookDetails: bookDetails,
                author: authors,
            },
        };

        await t.step("resolveDeepPath with empty path returns undefined", async () => {
            const result = DrizzleBuilder.resolveDeepPath(ctx, []);
            
            assertEquals(result, undefined);
        });

        await t.step("resolveDeepPath with path length 1 returns undefined", async () => {
            const result = DrizzleBuilder.resolveDeepPath(ctx, ["isbn"]);
            
            assertEquals(result, undefined);
        });

        await t.step("resolveDeepPath with valid 3-level path resolves correctly", async () => {
            const path = ["books", "bookDetails", "isbn"];
            const result = DrizzleBuilder.resolveDeepPath(ctx, path);
            
            assertExists(result);
            assertEquals(result, bookDetails.isbn);
        });

        await t.step("resolveDeepPath with valid 3-level path for pageCount resolves correctly", async () => {
            const path = ["books", "bookDetails", "pageCount"];
            const result = DrizzleBuilder.resolveDeepPath(ctx, path);
            
            assertExists(result);
            assertEquals(result, bookDetails.pageCount);
        });

        await t.step("resolveDeepPath with invalid relation name returns undefined", async () => {
            const path = ["books", "nonexistent", "isbn"];
            const result = DrizzleBuilder.resolveDeepPath(ctx, path);
            
            assertEquals(result, undefined);
        });

        await t.step("resolveDeepPath with missing field in relation table returns undefined", async () => {
            const path = ["books", "bookDetails", "nonexistentField"];
            const result = DrizzleBuilder.resolveDeepPath(ctx, path);
            
            assertEquals(result, undefined);
        });

        await t.step("resolveDeepPath with missing relationTables returns undefined", async () => {
            const noRelationCtx: QueryContext = {
                table: books,
            };
            const path = ["books", "bookDetails", "isbn"];
            const result = DrizzleBuilder.resolveDeepPath(noRelationCtx, path);
            
            assertEquals(result, undefined);
        });

        await t.step("resolveDeepPath with empty relationTables returns undefined", async () => {
            const emptyRelationCtx: QueryContext = {
                table: books,
                relationTables: {},
            };
            const path = ["books", "bookDetails", "isbn"];
            const result = DrizzleBuilder.resolveDeepPath(emptyRelationCtx, path);
            
            assertEquals(result, undefined);
        });

        await t.step("resolveDeepPath with path length 2 resolves correctly when relation exists", async () => {
            const path = ["bookDetails", "isbn"];
            const result = DrizzleBuilder.resolveDeepPath(ctx, path);
            
            assertExists(result);
            assertEquals(result, bookDetails.isbn);
        });

        await t.step("resolveDeepPath with path length 4 tests current behavior", async () => {
            const path = ["books", "bookDetails", "extra", "isbn"];
            const result = DrizzleBuilder.resolveDeepPath(ctx, path);
            
            assertEquals(result, undefined);
        });

        await t.step("resolveDeepPath with 3-level path where first relation exists but intermediate doesn't", async () => {
            const path = ["author", "nonexistent", "name"];
            const result = DrizzleBuilder.resolveDeepPath(ctx, path);
            
            assertEquals(result, undefined);
        });

        await t.step("resolveDeepPath with 3-level path tests fallback logic", async () => {
            const path = ["books", "bookDetails", "language"];
            const result = DrizzleBuilder.resolveDeepPath(ctx, path);
            
            assertExists(result);
            assertEquals(result, bookDetails.language);
        });

        await t.step("resolveDeepPath with different relation in path", async () => {
            const path = ["books", "author", "name"];
            const result = DrizzleBuilder.resolveDeepPath(ctx, path);
            
            assertExists(result);
            assertEquals(result, authors.name);
        });

        await t.step("resolveDeepPath with author email field", async () => {
            const path = ["books", "author", "email"];
            const result = DrizzleBuilder.resolveDeepPath(ctx, path);
            
            assertExists(result);
            assertEquals(result, authors.email);
        });
    },
});

