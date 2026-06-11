import { assertEquals } from "@std/assert";
import {
    groupEditorsByPermissionSlot,
    pickEditorsForFieldSplitDossier,
    type FieldSplitEditorRef,
} from "../modules/group/group-field-split-assign.ts";

function editor(userId: string, slotCode: string, slotSortOrder: number): FieldSplitEditorRef {
    return {
        userId,
        fullName: userId,
        allowedFields: [`${slotCode}.FIELD`],
        permissionSlotCode: slotCode,
        slotSortOrder,
    };
}

Deno.test("pickEditorsForFieldSplitDossier rotates within each slot independently", () => {
    const slotGroups = groupEditorsByPermissionSlot([
        editor("A", "Q1", 0),
        editor("B", "Q2", 1),
        editor("C", "Q2", 1),
        editor("D", "Q2", 1),
    ]);

    assertEquals(
        pickEditorsForFieldSplitDossier(slotGroups, 0).map((e) => e.userId),
        ["A", "B"],
    );
    assertEquals(
        pickEditorsForFieldSplitDossier(slotGroups, 1).map((e) => e.userId),
        ["A", "C"],
    );
    assertEquals(
        pickEditorsForFieldSplitDossier(slotGroups, 2).map((e) => e.userId),
        ["A", "D"],
    );
    assertEquals(
        pickEditorsForFieldSplitDossier(slotGroups, 3).map((e) => e.userId),
        ["A", "B"],
    );
});

Deno.test("pickEditorsForFieldSplitDossier orders slots by sortOrder", () => {
    const slotGroups = groupEditorsByPermissionSlot([
        editor("z", "Q2", 1),
        editor("a", "Q1", 0),
    ]);

    assertEquals(slotGroups.map((g) => g.slotCode), ["Q1", "Q2"]);
});
