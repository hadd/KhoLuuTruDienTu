import { assertEquals } from "@std/assert";
import { resolvePhysicalWarehouseSearchMode } from "../modules/physical-warehouse/physical-warehouse-search-mode.ts";

Deno.test("physical warehouse search mode defaults to all when q is present", () => {
  assertEquals(resolvePhysicalWarehouseSearchMode({}, "hợp đồng"), "all");
});

Deno.test("physical warehouse search mode defaults to metadata without q", () => {
  assertEquals(resolvePhysicalWarehouseSearchMode({}), "metadata");
});

Deno.test("physical warehouse search mode honors explicit content", () => {
  assertEquals(resolvePhysicalWarehouseSearchMode({ mode: "content" }, "x"), "content");
});
