import { assertEquals } from "@std/assert";
import { sql } from "drizzle-orm";
import { pgTable, uuid, varchar } from "drizzle-orm/pg-core";
import { createBaseRepo } from "../../src/repo/drizzle/drizzle-repo-factory.ts";
import { ListResult } from "../../src/repo/list-result.ts";
import { ListQueryBuilder } from "../../src/repo/query-builder.ts";
import type { PaginatedPageInfo } from "../../src/repo/types.ts";

const mockTable = pgTable("mock", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }),
});

Deno.test({
    name: "createBaseRepo - shape and customMethods",
    fn: async (t) => {
        await t.step("returns object with list, page, parseQuery, findById, getOne, create, update, delete", () => {
            const repo = createBaseRepo({ db: {} as any, table: mockTable });
            assertEquals(typeof repo.list, "function");
            assertEquals(typeof repo.page, "function");
            assertEquals(typeof repo.parseQuery, "function");
            assertEquals(typeof repo.findById, "function");
            assertEquals(typeof repo.getOne, "function");
            assertEquals(typeof repo.create, "function");
            assertEquals(typeof repo.update, "function");
            assertEquals(typeof repo.delete, "function");
        });

        await t.step("customMethods are merged", () => {
            const custom = { findByName: () => "ok" };
            const repo = createBaseRepo({ db: {} as any, table: mockTable }, custom);
            assertEquals(typeof repo.findById, "function");
            assertEquals((repo as any).findByName(), "ok");
        });
    },
});

Deno.test({
    name: "ListQueryBuilder - fluent API",
    fn: async (t) => {
        await t.step("build returns ListQuery", async () => {
            const q = new ListQueryBuilder({ page: 1, limit: 10 }).sort("name:desc").page(2).limit(20);
            const built = q.build();
            assertEquals(built.page, 2);
            assertEquals(built.limit, 20);
            assertEquals(built.sort?.length, 1);
            assertEquals(built.sort?.[0].field, "name");
            assertEquals(built.sort?.[0].direction, "desc");
        });

        await t.step("where adds direct SQL", async () => {
            const cond = sql`1=1`;
            const q = new ListQueryBuilder().where(cond);
            assertEquals(q.getDirectWhere().length, 1);
        });

        await t.step("whereFilter adds spec filter", async () => {
            const q = new ListQueryBuilder().whereFilter({ name: { $eq: "x" } });
            const built = q.build();
            assertEquals(built.filter != null, true);
        });
    },
});

Deno.test({
    name: "ListResult - shape and enrichment",
    fn: async (t) => {
        await t.step("items and pageInfo", async () => {
            const items = [{ id: "1", name: "a" }];
            const meta: PaginatedPageInfo = {
                page: 1,
                totalPages: 1,
                limit: 10,
                total: 1,
                hasNextPage: false,
                hasPreviousPage: false,
            };
            const result = new ListResult(items, meta);
            assertEquals(result.items, items);
            assertEquals(result.items.length, 1);
            assertEquals(result.pageInfo(), meta);
        });

        await t.step("getters", async () => {
            const meta: PaginatedPageInfo = {
                page: 2,
                totalPages: 5,
                limit: 20,
                total: 100,
                hasNextPage: true,
                hasPreviousPage: true,
            };
            const result = new ListResult([], meta);
            assertEquals(result.page, 2);
            assertEquals(result.totalPages, 5);
            assertEquals(result.limit, 20);
            assertEquals(result.total, 100);
            assertEquals(result.hasNextPage, true);
            assertEquals(result.hasPreviousPage, true);
        });

        await t.step("toJSON returns items only", async () => {
            const items = [{ id: "1" }];
            const meta: PaginatedPageInfo = {
                page: 1,
                totalPages: 1,
                limit: 10,
                total: 1,
                hasNextPage: false,
                hasPreviousPage: false,
            };
            const result = new ListResult(items, meta);
            assertEquals(result.toJSON(), { items });
        });
    },
});
