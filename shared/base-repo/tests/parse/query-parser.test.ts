import { assertEquals, assertExists } from "@std/assert";
import { parseQueryString } from "../../src/parse/query-parser.ts";
import type { FilterCondition } from "../../src/parse/types.ts";

Deno.test({
    name: "Query Parser - Input Types",
    fn: async (t) => {
        await t.step("parseQueryString with URLSearchParams", async () => {
            const params = new URLSearchParams("search=test&page=1&limit=10");
            const result = parseQueryString(params);
            assertEquals(result.search, "test");
            assertEquals(result.page, 1);
            assertEquals(result.limit, 10);
        });

        await t.step("parseQueryString with string with ?", async () => {
            const result = parseQueryString("?search=test&page=1");
            assertEquals(result.search, "test");
            assertEquals(result.page, 1);
        });

        await t.step("parseQueryString with string without ?", async () => {
            const result = parseQueryString("search=test&page=1");
            assertEquals(result.search, "test");
            assertEquals(result.page, 1);
        });

        await t.step("parseQueryString with Record", async () => {
            const result = parseQueryString({
                search: "test",
                page: "1",
                limit: "10",
            });
            assertEquals(result.search, "test");
            assertEquals(result.page, 1);
            assertEquals(result.limit, 10);
        });

        await t.step("parseQueryString with Record filter", async () => {
            const result = parseQueryString({
                search: "test",
                filter: {
                    name: { $eq: "Test" },
                },
            });
            assertEquals(result.search, "test");
            assertExists(result.filter);
        });
    },
});

Deno.test({
    name: "Query Parser - Search",
    fn: async (t) => {
        await t.step("normalizes + to space in search", async () => {
            const result = parseQueryString("search=test+query");
            assertEquals(result.search, "test query");
        });

        await t.step("no search param", async () => {
            const result = parseQueryString("page=1");
            assertEquals(result.search, undefined);
        });
    },
});

Deno.test({
    name: "Query Parser - Pagination",
    fn: async (t) => {
        await t.step("default page and limit", async () => {
            const result = parseQueryString({});
            assertEquals(result.page, 1);
            assertEquals(result.limit, 50);
        });

        await t.step("page and limit from params", async () => {
            const result = parseQueryString("page=2&limit=20");
            assertEquals(result.page, 2);
            assertEquals(result.limit, 20);
        });

        await t.step("paging false uses unpaged limit", async () => {
            const result = parseQueryString("paging=false&limit=5");
            assertEquals(result.paging, false);
            assertEquals(result.limit, 5);
        });
    },
});

Deno.test({
    name: "Query Parser - Sort",
    fn: async (t) => {
        await t.step("sort from string", async () => {
            const result = parseQueryString("sort=name:desc,createdAt:asc");
            assertExists(result.sort);
            assertEquals(result.sort!.length, 2);
            assertEquals(result.sort![0].field, "name");
            assertEquals(result.sort![0].direction, "desc");
            assertEquals(result.sort![1].field, "createdAt");
            assertEquals(result.sort![1].direction, "asc");
        });
    },
});

Deno.test({
    name: "Query Parser - Filter",
    fn: async (t) => {
        await t.step("bracket filter", async () => {
            const params = new URLSearchParams();
            params.set("filter[name][$eq]", "Foo");
            const result = parseQueryString(params);
            assertExists(result.filter);
            const f = result.filter as FilterCondition;
            assertEquals(f.field, "name");
            assertEquals(f.op, "$eq");
            assertEquals(f.value, "Foo");
        });

        await t.step("JSON filter", async () => {
            const filterJson = JSON.stringify({ name: { $eq: "Bar" } });
            const params = new URLSearchParams();
            params.set("filter", filterJson);
            const result = parseQueryString(params);
            assertExists(result.filter);
            const f = result.filter as FilterCondition;
            assertEquals(f.field, "name");
            assertEquals(f.op, "$eq");
            assertEquals(f.value, "Bar");
        });

        await t.step("Record with filter object", async () => {
            const result = parseQueryString({
                filter: {
                    status: { $in: ["a", "b"] },
                },
            });
            assertExists(result.filter);
            const f = result.filter as FilterCondition;
            assertEquals(f.field, "status");
            assertEquals(f.op, "$in");
            assertEquals(Array.isArray(f.value) && f.value.length, 2);
        });
    },
});
