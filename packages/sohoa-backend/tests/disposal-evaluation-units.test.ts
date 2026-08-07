import { assertEquals } from "jsr:@std/assert";

import { resolveEvaluationUnitIds } from "../modules/archive-disposal/disposal-evaluation-units.ts";

Deno.test("resolveEvaluationUnitIds uses dossier row when present", () => {
    const units = resolveEvaluationUnitIds([
        { id: "d1", dossierId: "hs-1", fileId: null },
        { id: "f1", dossierId: "hs-1", fileId: "file-1" },
    ]);
    assertEquals(units, ["d1"]);
});

Deno.test("resolveEvaluationUnitIds uses document rows when no dossier row", () => {
    const units = resolveEvaluationUnitIds([
        { id: "f1", dossierId: "hs-1", fileId: "file-1" },
        { id: "f2", dossierId: "hs-1", fileId: "file-2" },
    ]);
    assertEquals(units.sort(), ["f1", "f2"]);
});

Deno.test("resolveEvaluationUnitIds handles mixed dossiers", () => {
    const units = resolveEvaluationUnitIds([
        { id: "d1", dossierId: "hs-1", fileId: null },
        { id: "f1", dossierId: "hs-2", fileId: "file-1" },
    ]);
    assertEquals(units.sort(), ["d1", "f1"]);
});
