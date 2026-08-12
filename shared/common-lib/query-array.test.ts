import { assertEquals } from "jsr:@std/assert";
import { normalizeQueryStringArray } from "./query-array.ts";

Deno.test("normalizeQueryStringArray splits comma-separated ids", () => {
  assertEquals(normalizeQueryStringArray("a,b"), ["a", "b"]);
});

Deno.test("normalizeQueryStringArray preserves arrays", () => {
  assertEquals(normalizeQueryStringArray(["a", "b"]), ["a", "b"]);
});

Deno.test("normalizeQueryStringArray trims and drops empty values", () => {
  assertEquals(normalizeQueryStringArray([" a ", "", "b"]), ["a", "b"]);
});
