import { assertEquals } from "@std/assert";
import { mergeFondIds } from "../modules/archive-disposal/disposal-catalog-fond-rules.ts";

Deno.test("mergeFondIds accepts single fond on empty catalog", () => {
    assertEquals(mergeFondIds([], ["fond-a"]), { ok: true, fondId: "fond-a" });
});

Deno.test("mergeFondIds rejects null incoming fond", () => {
    assertEquals(mergeFondIds([], [null]), { ok: false, code: "MISSING_FOND" });
    assertEquals(mergeFondIds(["fond-a"], [null]), {
        ok: false,
        code: "MISSING_FOND",
    });
});

Deno.test("mergeFondIds rejects mixed incoming fonds", () => {
    assertEquals(mergeFondIds([], ["fond-a", "fond-b"]), {
        ok: false,
        code: "MIXED_FOND",
    });
});

Deno.test("mergeFondIds rejects mismatch with catalog fond", () => {
    assertEquals(mergeFondIds(["fond-a"], ["fond-b"]), {
        ok: false,
        code: "MIXED_FOND",
    });
});

Deno.test("mergeFondIds accepts matching catalog and incoming fond", () => {
    assertEquals(mergeFondIds(["fond-a"], ["fond-a"]), {
        ok: true,
        fondId: "fond-a",
    });
});

Deno.test("mergeFondIds rejects catalog with multiple fonds", () => {
    assertEquals(mergeFondIds(["fond-a", "fond-b"], ["fond-a"]), {
        ok: false,
        code: "CATALOG_MIXED_FOND",
    });
});
