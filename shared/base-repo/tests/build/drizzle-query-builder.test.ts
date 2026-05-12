import { assertEquals, assertExists } from "@std/assert";
import { eq } from "drizzle-orm";
import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { buildDrizzleQuery } from "../../src/build/drizzle-query-builder.ts";
import type { QueryContext } from "../../src/build/types.ts";
import type { FilterCondition, ListQuery, SortItem } from "../../src/parse/types.ts";

const testTable = pgTable("test_table", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

Deno.test({
    name: "Drizzle Query Builder - buildDrizzleQuery",
    fn: async (t) => {
        const ctx: QueryContext = {
            table: testTable,
            searchable: ["name"],
        };

        await t.step("no filter or search returns where undefined or extraFilters only", async () => {
            const parsed: ListQuery = { page: 1, limit: 10 };
            const result = buildDrizzleQuery(parsed, ctx);
            assertEquals(result.limit, 10);
            assertEquals(result.offset, 0);
            assertExists(result.orderBy);
        });

        await t.step("extraFilters applied", async () => {
            const parsed: ListQuery = { page: 1, limit: 10 };
            const extra = eq(testTable.id, "x");
            const result = buildDrizzleQuery(parsed, ctx, [extra]);
            assertExists(result.where);
        });

        await t.step("filter applied", async () => {
            const filter: FilterCondition = { field: "name", op: "$eq", value: "Foo" };
            const parsed: ListQuery = { page: 1, limit: 10, filter };
            const result = buildDrizzleQuery(parsed, ctx);
            assertExists(result.where);
        });

        await t.step("search applied", async () => {
            const parsed: ListQuery = { page: 1, limit: 10, search: "test" };
            const result = buildDrizzleQuery(parsed, ctx);
            assertExists(result.where);
        });

        await t.step("sort applied", async () => {
            const sort: SortItem[] = [{ field: "name", direction: "desc" }];
            const parsed: ListQuery = { page: 1, limit: 10, sort };
            const result = buildDrizzleQuery(parsed, ctx);
            assertEquals(result.orderBy.length, 1);
        });

        await t.step("directWhere merged", async () => {
            const parsed: ListQuery = { page: 1, limit: 10 };
            const direct = eq(testTable.name, "Bar");
            const result = buildDrizzleQuery(parsed, ctx, [], direct);
            assertExists(result.where);
        });

        await t.step("page and offset", async () => {
            const parsed: ListQuery = { page: 3, limit: 20 };
            const result = buildDrizzleQuery(parsed, ctx);
            assertEquals(result.limit, 20);
            assertEquals(result.offset, 40);
        });
    },
});
