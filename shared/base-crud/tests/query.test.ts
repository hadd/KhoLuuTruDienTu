import { assertEquals, assertExists } from "@std/assert";
import { parseQueryString } from "../src/query.ts";

Deno.test({
    name: "Query - parseQueryString Input Types",
    fn: async (t) => {
        await t.step("parseQueryString with URLSearchParams", async () => {
            const params = new URLSearchParams("search=test&page=1&limit=10");
            const result = parseQueryString(params);
            
            assertEquals(result.search, "test");
            assertEquals(result.page, 1);
            assertEquals(result.limit, 10);
        });

        await t.step("parseQueryString with string starting with ?", async () => {
            const result = parseQueryString("?search=test&page=1");
            
            assertEquals(result.search, "test");
            assertEquals(result.page, 1);
        });

        await t.step("parseQueryString with string without ?", async () => {
            const result = parseQueryString("search=test&page=1");
            
            assertEquals(result.search, "test");
            assertEquals(result.page, 1);
        });

        await t.step("parseQueryString with plain object", async () => {
            const result = parseQueryString({
                search: "test",
                page: "1",
                limit: "10",
            });
            
            assertEquals(result.search, "test");
            assertEquals(result.page, 1);
            assertEquals(result.limit, 10);
        });

        await t.step("parseQueryString with nested object", async () => {
            const result = parseQueryString({
                search: "test",
                filter: {
                    name: {
                        $eq: "Test",
                    },
                },
            });
            
            assertEquals(result.search, "test");
            assertExists(result.filter);
        });
    },
});

Deno.test({
    name: "Query - Search Normalization",
    fn: async (t) => {
        await t.step("parseQueryString normalizes + to space in search", async () => {
            const result = parseQueryString("search=test+query");
            
            assertEquals(result.search, "test query");
        });

        await t.step("parseQueryString handles multiple + in search", async () => {
            const result = parseQueryString("search=test+query+with+spaces");
            
            assertEquals(result.search, "test query with spaces");
        });

        await t.step("parseQueryString with no search parameter", async () => {
            const result = parseQueryString("page=1");
            
            assertEquals(result.search, undefined);
        });

        await t.step("parseQueryString with empty search", async () => {
            const result = parseQueryString("search=");
            
            assertEquals(result.search, "");
        });
    },
});

Deno.test({
    name: "Query - Sort Parsing",
    fn: async (t) => {
        await t.step("parseQueryString with single sort asc", async () => {
            const result = parseQueryString("sort=name:asc");
            
            assertExists(result.sort);
            assertEquals(result.sort!.length, 1);
            assertEquals(result.sort![0].field, "name");
            assertEquals(result.sort![0].direction, "asc");
        });

        await t.step("parseQueryString with single sort desc", async () => {
            const result = parseQueryString("sort=name:desc");
            
            assertExists(result.sort);
            assertEquals(result.sort!.length, 1);
            assertEquals(result.sort![0].field, "name");
            assertEquals(result.sort![0].direction, "desc");
        });

        await t.step("parseQueryString with sort without direction defaults to asc", async () => {
            const result = parseQueryString("sort=name");
            
            assertExists(result.sort);
            assertEquals(result.sort!.length, 1);
            assertEquals(result.sort![0].field, "name");
            assertEquals(result.sort![0].direction, "asc");
        });

        await t.step("parseQueryString with multiple sorts", async () => {
            const result = parseQueryString("sort=name:asc,id:desc");
            
            assertExists(result.sort);
            assertEquals(result.sort!.length, 2);
            assertEquals(result.sort![0].field, "name");
            assertEquals(result.sort![0].direction, "asc");
            assertEquals(result.sort![1].field, "id");
            assertEquals(result.sort![1].direction, "desc");
        });

        await t.step("parseQueryString with nested field sort", async () => {
            const result = parseQueryString("sort=author.name:asc");
            
            assertExists(result.sort);
            assertEquals(result.sort!.length, 1);
            assertEquals(result.sort![0].field, "author.name");
            assertEquals(result.sort![0].relation, "author");
            assertEquals(result.sort![0].relationField, "name");
        });

        await t.step("parseQueryString with sort containing spaces", async () => {
            const result = parseQueryString("sort=name:asc, id:desc");
            
            assertExists(result.sort);
            assertEquals(result.sort!.length, 2);
        });

        await t.step("parseQueryString with empty sort", async () => {
            const result = parseQueryString("sort=");
            
            assertEquals(result.sort, undefined);
        });

        await t.step("parseQueryString with sort containing empty items", async () => {
            const result = parseQueryString("sort=name:asc,,id:desc");
            
            assertExists(result.sort);
            assertEquals(result.sort!.length, 2);
        });
    },
});

Deno.test({
    name: "Query - Pagination",
    fn: async (t) => {
        await t.step("parseQueryString with default pagination (paging undefined)", async () => {
            const result = parseQueryString("page=1");
            
            assertEquals(result.page, 1);
            assertEquals(result.limit, 50);
            assertEquals(result.paging, undefined);
        });

        await t.step("parseQueryString with paging=true", async () => {
            const result = parseQueryString("paging=true&page=2&limit=20");
            
            assertEquals(result.paging, true);
            assertEquals(result.page, 2);
            assertEquals(result.limit, 20);
        });

        await t.step("parseQueryString with paging=false", async () => {
            const result = parseQueryString("paging=false&limit=15");
            
            assertEquals(result.paging, false);
            assertEquals(result.limit, 15);
        });

        await t.step("parseQueryString with paging=false enforces maxLimit 50", async () => {
            const result = parseQueryString("paging=false&limit=100");
            
            assertEquals(result.paging, false);
            assertEquals(result.limit, 50);
        });

        await t.step("parseQueryString with paging=true enforces maxLimit 400", async () => {
            const result = parseQueryString("paging=true&limit=500");
            
            assertEquals(result.paging, true);
            assertEquals(result.limit, 400);
        });

        await t.step("parseQueryString with limit below minimum defaults to 1", async () => {
            const result = parseQueryString("limit=0");
            
            assertEquals(result.limit, 1);
        });

        await t.step("parseQueryString with invalid limit defaults to defaultLimit", async () => {
            const result = parseQueryString("limit=invalid");
            
            assertEquals(result.limit, 50);
        });

        await t.step("parseQueryString with page below 1 defaults to 1", async () => {
            const result = parseQueryString("page=0");
            
            assertEquals(result.page, 1);
        });

        await t.step("parseQueryString with negative page defaults to 1", async () => {
            const result = parseQueryString("page=-1");
            
            assertEquals(result.page, 1);
        });

        await t.step("parseQueryString with invalid page defaults to 1", async () => {
            const result = parseQueryString("page=invalid");
            
            assertEquals(result.page, 1);
        });

        await t.step("parseQueryString with paging=false and no limit uses defaultLimit 10", async () => {
            const result = parseQueryString("paging=false");
            
            assertEquals(result.limit, 10);
        });
    },
});

Deno.test({
    name: "Query - Filter Bracket Notation",
    fn: async (t) => {
        await t.step("parseQueryString with simple bracket filter", async () => {
            const result = parseQueryString("filter[name][$eq]=Test");
            
            assertExists(result.filter);
            const filter = result.filter as any;
            assertEquals(filter.field, "name");
            assertEquals(filter.op, "$eq");
            assertEquals(filter.value, "Test");
        });

        await t.step("parseQueryString with $in operator", async () => {
            const result = parseQueryString("filter[id][$in]=[1,2,3]");
            
            assertExists(result.filter);
        });

        await t.step("parseQueryString with $gte operator", async () => {
            const result = parseQueryString("filter[id][$gte]=10");
            
            assertExists(result.filter);
            const filter = result.filter as any;
            assertEquals(filter.op, "$gte");
            assertEquals(filter.value, 10);
        });

        await t.step("parseQueryString with $lte operator", async () => {
            const result = parseQueryString("filter[id][$lte]=100");
            
            assertExists(result.filter);
            const filter = result.filter as any;
            assertEquals(filter.op, "$lte");
            assertEquals(filter.value, 100);
        });

        await t.step("parseQueryString with $gt operator", async () => {
            const result = parseQueryString("filter[id][$gt]=5");
            
            assertExists(result.filter);
            const filter = result.filter as any;
            assertEquals(filter.op, "$gt");
        });

        await t.step("parseQueryString with $lt operator", async () => {
            const result = parseQueryString("filter[id][$lt]=50");
            
            assertExists(result.filter);
            const filter = result.filter as any;
            assertEquals(filter.op, "$lt");
        });

        await t.step("parseQueryString with $nin operator", async () => {
            const result = parseQueryString("filter[id][$nin]=[1,2,3]");
            
            assertExists(result.filter);
            const filter = result.filter as any;
            assertEquals(filter.op, "$nin");
        });

        await t.step("parseQueryString with nested field filter", async () => {
            const result = parseQueryString("filter[author.name][$eq]=John");
            
            assertExists(result.filter);
            const filter = result.filter as any;
            assertEquals(filter.field, "author.name");
            assertEquals(filter.relation, "author");
            assertEquals(filter.relationField, "name");
        });

        await t.step("parseQueryString with $and group in bracket notation", async () => {
            const result = parseQueryString("filter[$and][0][name][$eq]=Test&filter[$and][1][id][$gt]=0");
            
            assertExists(result.filter);
            const filter = result.filter as any;
            assertExists(filter.$and);
            assertEquals(filter.$and.length, 2);
        });

        await t.step("parseQueryString with $or group in bracket notation", async () => {
            const result = parseQueryString("filter[$or][0][name][$eq]=Test&filter[$or][1][id][$gt]=0");
            
            assertExists(result.filter);
            const filter = result.filter as any;
            assertExists(filter.$or);
            assertEquals(filter.$or.length, 2);
        });

        await t.step("parseQueryString with multiple filters creates $and", async () => {
            const result = parseQueryString("filter[name][$eq]=Test&filter[id][$gt]=0");
            
            assertExists(result.filter);
            const filter = result.filter as any;
            assertExists(filter.$and);
            assertEquals(filter.$and.length, 2);
        });

        await t.step("parseQueryString with array-style brackets", async () => {
            const result = parseQueryString("filter[$and][][name][$eq]=Test");
            
            assertExists(result.filter);
        });
    },
});

Deno.test({
    name: "Query - Filter JSON",
    fn: async (t) => {
        await t.step("parseQueryString with JSON filter", async () => {
            const filterJson = JSON.stringify({ name: { $eq: "Test" } });
            const result = parseQueryString(`filter=${encodeURIComponent(filterJson)}`);
            
            assertExists(result.filter);
            const filter = result.filter as any;
            assertEquals(filter.field, "name");
            assertEquals(filter.op, "$eq");
            assertEquals(filter.value, "Test");
        });

        await t.step("parseQueryString with JSON filter containing $and", async () => {
            const filterJson = JSON.stringify({
                $and: [
                    { name: { $eq: "Test" } },
                    { id: { $gt: 0 } },
                ],
            });
            const result = parseQueryString(`filter=${encodeURIComponent(filterJson)}`);
            
            assertExists(result.filter);
            const filter = result.filter as any;
            assertExists(filter.$and);
            assertEquals(filter.$and.length, 2);
        });

        await t.step("parseQueryString with JSON filter containing $or", async () => {
            const filterJson = JSON.stringify({
                $or: [
                    { name: { $eq: "Test" } },
                    { id: { $gt: 0 } },
                ],
            });
            const result = parseQueryString(`filter=${encodeURIComponent(filterJson)}`);
            
            assertExists(result.filter);
            const filter = result.filter as any;
            assertExists(filter.$or);
            assertEquals(filter.$or.length, 2);
        });

        await t.step("parseQueryString with invalid JSON filter ignores it", async () => {
            const result = parseQueryString("filter=invalid json");
            
            assertEquals(result.filter, undefined);
        });

        await t.step("parseQueryString with JSON filter and bracket notation prefers bracket", async () => {
            const filterJson = JSON.stringify({ name: { $eq: "JSON" } });
            const result = parseQueryString(`filter[name][$eq]=Bracket&filter=${encodeURIComponent(filterJson)}`);
            
            assertExists(result.filter);
            const filter = result.filter as any;
            assertEquals(filter.value, "Bracket");
        });
    },
});

Deno.test({
    name: "Query - Value Coercion",
    fn: async (t) => {
        await t.step("parseQueryString coerces true to boolean", async () => {
            const result = parseQueryString("filter[active][$eq]=true");
            
            assertExists(result.filter);
            const filter = result.filter as any;
            assertEquals(filter.value, true);
        });

        await t.step("parseQueryString coerces false to boolean", async () => {
            const result = parseQueryString("filter[active][$eq]=false");
            
            assertExists(result.filter);
            const filter = result.filter as any;
            assertEquals(filter.value, false);
        });

        await t.step("parseQueryString coerces numeric string to number", async () => {
            const result = parseQueryString("filter[id][$eq]=123");
            
            assertExists(result.filter);
            const filter = result.filter as any;
            assertEquals(filter.value, 123);
            assertEquals(typeof filter.value, "number");
        });

        await t.step("parseQueryString parses JSON array", async () => {
            const result = parseQueryString("filter[id][$in]=[1,2,3]");
            
            assertExists(result.filter);
            const filter = result.filter as any;
            assertEquals(Array.isArray(filter.value), true);
        });

        await t.step("parseQueryString handles array-like string", async () => {
            const result = parseQueryString("filter[id][$in]=[1, 2, 3]");
            
            assertExists(result.filter);
        });

        await t.step("parseQueryString handles $in with comma-separated string", async () => {
            const result = parseQueryString("filter[id][$in]=1,2,3");
            
            assertExists(result.filter);
            const filter = result.filter as any;
            assertEquals(Array.isArray(filter.value), true);
        });

        await t.step("parseQueryString handles $nin with comma-separated string", async () => {
            const result = parseQueryString("filter[id][$nin]=1,2,3");
            
            assertExists(result.filter);
            const filter = result.filter as any;
            assertEquals(Array.isArray(filter.value), true);
        });
    },
});

Deno.test({
    name: "Query - Debug Mode",
    fn: async (t) => {
        await t.step("parseQueryString with debug=true", async () => {
            const result = parseQueryString("debug=true");
            
            assertEquals(result.debug, true);
        });

        await t.step("parseQueryString with debug=false", async () => {
            const result = parseQueryString("debug=false");
            
            assertEquals(result.debug, false);
        });

        await t.step("parseQueryString without debug parameter", async () => {
            const result = parseQueryString("page=1");
            
            assertEquals(result.debug, false);
        });
    },
});

Deno.test({
    name: "Query - Edge Cases",
    fn: async (t) => {
        await t.step("parseQueryString with empty input", async () => {
            const result = parseQueryString("");
            
            assertEquals(result.search, undefined);
            assertEquals(result.filter, undefined);
            assertEquals(result.sort, undefined);
        });

        await t.step("parseQueryString with empty object", async () => {
            const result = parseQueryString({});
            
            assertEquals(result.search, undefined);
            assertEquals(result.filter, undefined);
            assertEquals(result.sort, undefined);
        });

        await t.step("parseQueryString with filter containing non-object ops", async () => {
            const result = parseQueryString("filter[name]=value");
            
            assertEquals(result.filter, undefined);
        });

        await t.step("parseQueryString with filter containing invalid operator", async () => {
            const result = parseQueryString("filter[name][$invalid]=value");
            
            assertEquals(result.filter, undefined);
        });

        await t.step("parseQueryString with nested object flattening", async () => {
            const result = parseQueryString({
                filter: {
                    name: {
                        $eq: "Test",
                    },
                },
            });
            
            assertExists(result.filter);
        });
    },
});

