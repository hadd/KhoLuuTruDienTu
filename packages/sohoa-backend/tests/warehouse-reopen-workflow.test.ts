import { assertEquals } from "@std/assert";
import {
    buildActiveMakerIndex,
    buildCompletedMakerIndex,
    isDossierMakerEntryComplete,
} from "../modules/group/group-assignment-guards.ts";

Deno.test("warehouse reopen reset makes dossier eligible for group queue again", () => {
    const dossierId = "dossier-1";
    const editorId = "editor-1";

    const beforeActive = buildActiveMakerIndex([]);
    const beforeCompleted = buildCompletedMakerIndex([
        { dossierId, assigneeId: editorId },
    ]);
    assertEquals(
        isDossierMakerEntryComplete(dossierId, beforeActive, beforeCompleted),
        true,
    );

    const afterActive = buildActiveMakerIndex([
        { dossierId, assigneeId: editorId },
    ]);
    assertEquals(
        isDossierMakerEntryComplete(dossierId, afterActive, beforeCompleted),
        false,
    );
});
