import { assertEquals } from "@std/assert";
import {
    buildActiveMakerIndex,
    buildCompletedMakerIndex,
    isDossierMakerEntryComplete,
} from "../modules/group/group-assignment-guards.ts";

Deno.test("isDossierMakerEntryComplete — blocks QC when any maker still workable", () => {
    const active = buildActiveMakerIndex([
        { dossierId: "hs1", assigneeId: "e2" },
    ]);
    const completed = buildCompletedMakerIndex([
        { dossierId: "hs1", assigneeId: "e1" },
    ]);

    assertEquals(isDossierMakerEntryComplete("hs1", active, completed), false);

    const activeEmpty = buildActiveMakerIndex([]);
    assertEquals(isDossierMakerEntryComplete("hs1", activeEmpty, completed), true);
});

Deno.test("isDossierMakerEntryComplete — no makers after invalidate is not complete", () => {
    const active = buildActiveMakerIndex([]);
    const completed = buildCompletedMakerIndex([]);
    assertEquals(isDossierMakerEntryComplete("hs1", active, completed), false);
});
