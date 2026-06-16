import { assertEquals } from "@std/assert";
import {
    buildActiveMakerIndex,
    buildCompletedMakerIndex,
    countFieldSplitAssignedDossierOrdinals,
    getMakerAssignmentBlockReason,
    hasActiveGroupMakerOnDossier,
    hasActiveMakerOnDossier,
    isDossierMakerEntryComplete,
} from "../modules/group/group-assignment-guards.ts";

const editorIds = new Set(["editor-a", "editor-b", "editor-c"]);

Deno.test("hasActiveMakerOnDossier tracks all active makers on a dossier", () => {
    const index = buildActiveMakerIndex([
        { dossierId: "d1", assigneeId: "editor-a" },
        { dossierId: "d1", assigneeId: "editor-b" },
    ]);

    assertEquals(hasActiveMakerOnDossier(index, "d1"), true);
    assertEquals(hasActiveGroupMakerOnDossier(index, "d1", editorIds), true);
    assertEquals(hasActiveMakerOnDossier(index, "d2"), false);
});

Deno.test("isDossierMakerEntryComplete requires no active makers and some completed", () => {
    const active = buildActiveMakerIndex([
        { dossierId: "d1", assigneeId: "editor-b" },
    ]);
    const completed = buildCompletedMakerIndex([
        { dossierId: "d1", assigneeId: "editor-a" },
    ]);

    assertEquals(isDossierMakerEntryComplete("d1", active, completed), false);

    const activeEmpty = buildActiveMakerIndex([]);
    assertEquals(isDossierMakerEntryComplete("d1", activeEmpty, completed), true);
    assertEquals(isDossierMakerEntryComplete("d2", activeEmpty, completed), false);
});

Deno.test("getMakerAssignmentBlockReason blocks approved and completed entry", () => {
    const active = buildActiveMakerIndex([]);
    const completed = buildCompletedMakerIndex([
        { dossierId: "d-done", assigneeId: "editor-a" },
    ]);

    assertEquals(
        getMakerAssignmentBlockReason({
            dossierStatus: "APPROVED",
            dossierId: "d1",
            activeMakerIndex: active,
            completedMakerIndex: completed,
        }),
        "Dossier already approved",
    );
    assertEquals(
        getMakerAssignmentBlockReason({
            dossierStatus: "WAITING_CHECKER_1",
            dossierId: "d-done",
            activeMakerIndex: active,
            completedMakerIndex: completed,
        }),
        "Dossier maker entry already completed",
    );
    assertEquals(
        getMakerAssignmentBlockReason({
            dossierStatus: "READY_FOR_ENTRY",
            dossierId: "d-new",
            activeMakerIndex: buildActiveMakerIndex([
                { dossierId: "d-new", assigneeId: "editor-a" },
            ]),
            completedMakerIndex: completed,
        }),
        null,
    );
});

Deno.test("countFieldSplitAssignedDossierOrdinals counts active and completed dossiers", () => {
    const active = buildActiveMakerIndex([
        { dossierId: "d-active", assigneeId: "editor-a" },
    ]);
    const completed = buildCompletedMakerIndex([
        { dossierId: "d-done", assigneeId: "editor-a" },
        { dossierId: "d-done", assigneeId: "editor-b" },
    ]);

    assertEquals(
        countFieldSplitAssignedDossierOrdinals({
            targets: [
                { dossierId: "d-active" },
                { dossierId: "d-done" },
                { dossierId: "d-new" },
            ],
            activeMakerIndex: active,
            completedMakerIndex: completed,
            editorIds,
        }),
        2,
    );
});
