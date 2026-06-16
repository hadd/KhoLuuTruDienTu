import { assertEquals } from "@std/assert";
import { shouldSkipExistingAip } from "../libs/archival-package/aip-idempotent.ts";

Deno.test("shouldSkipExistingAip returns true when WORM object exists", () => {
    assertEquals(shouldSkipExistingAip({
        exists: true,
        size: 100,
        lastModified: new Date(),
        etag: "abc",
    }), true);
});

Deno.test("shouldSkipExistingAip returns false when object missing", () => {
    assertEquals(shouldSkipExistingAip({
        exists: false,
        size: 0,
        lastModified: null,
        etag: null,
    }), false);
});
