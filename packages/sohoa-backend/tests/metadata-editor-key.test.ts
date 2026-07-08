import { assertEquals } from "@std/assert";
import {
    buildCuratedMetadataUpdateKey,
    buildDraftMetadataKey,
    buildEditorMergedMetadataKey,
} from "../modules/data-entry/metadata-storage-keys.ts";

type CheckerRole = Parameters<typeof buildCuratedMetadataUpdateKey>[1];
const CHECKER_1 = "CHECKER_1" as CheckerRole;
const CHECKER_2 = "CHECKER_2" as CheckerRole;

Deno.test("buildEditorMergedMetadataKey uses _EDITOR.json for first attempt", () => {
    assertEquals(
        buildEditorMergedMetadataKey("folder/metadata/ho_so.json"),
        "folder/metadata/ho_so_EDITOR.json",
    );
    assertEquals(
        buildEditorMergedMetadataKey("folder/metadata/ho_so.json", 1),
        "folder/metadata/ho_so_EDITOR.json",
    );
});

Deno.test("buildEditorMergedMetadataKey versions key after reject/resubmit", () => {
    assertEquals(
        buildEditorMergedMetadataKey("folder/metadata/ho_so.json", 2),
        "folder/metadata/ho_so_EDITOR_A2.json",
    );
    assertEquals(
        buildEditorMergedMetadataKey("folder/metadata/ho_so_EDITOR.json", 3),
        "folder/metadata/ho_so_EDITOR_A3.json",
    );
});

Deno.test("buildCuratedMetadataUpdateKey uses role suffix for first attempt", () => {
    assertEquals(
        buildCuratedMetadataUpdateKey("folder/metadata/ho_so.json", CHECKER_1),
        "folder/Curated/metadata_update/ho_so_CHECKER_1.json",
    );
    assertEquals(
        buildCuratedMetadataUpdateKey("folder/metadata/ho_so.json", CHECKER_2, 1),
        "folder/Curated/metadata_update/ho_so_CHECKER_2.json",
    );
});

Deno.test("buildCuratedMetadataUpdateKey versions key after reject/resubmit", () => {
    assertEquals(
        buildCuratedMetadataUpdateKey("folder/metadata/ho_so.json", CHECKER_1, 2),
        "folder/Curated/metadata_update/ho_so_CHECKER_1_A2.json",
    );
    assertEquals(
        buildCuratedMetadataUpdateKey(
            "folder/Curated/metadata_update/ho_so_CHECKER_2.json",
            CHECKER_2,
            3,
        ),
        "folder/Curated/metadata_update/ho_so_CHECKER_2_A3.json",
    );
});

Deno.test("buildDraftMetadataKey appends _DRAFT before extension", () => {
    assertEquals(
        buildDraftMetadataKey("folder/metadata/ho_so_EDITOR.json"),
        "folder/metadata/ho_so_EDITOR_DRAFT.json",
    );
    assertEquals(
        buildDraftMetadataKey("folder/Curated/metadata_update/ho_so_CHECKER_1.json"),
        "folder/Curated/metadata_update/ho_so_CHECKER_1_DRAFT.json",
    );
});

Deno.test("buildDraftMetadataKey scopes draft by assignment", () => {
    assertEquals(
        buildDraftMetadataKey("folder/metadata/ho_so_EDITOR.json", "75d5fa01-53be-4db3-a706-af56069a0c40"),
        "folder/metadata/ho_so_EDITOR_DRAFT_75d5fa01.json",
    );
    assertEquals(
        buildDraftMetadataKey(
            "folder/Curated/metadata_update/ho_so_CHECKER_1_DRAFT.json",
            "abc12345-53be-4db3-a706-af56069a0c40",
        ),
        "folder/Curated/metadata_update/ho_so_CHECKER_1_DRAFT_abc12345.json",
    );
});

Deno.test("buildDraftMetadataKey is idempotent for keys already ending with _DRAFT", () => {
    assertEquals(
        buildDraftMetadataKey("folder/metadata/ho_so_EDITOR_DRAFT.json"),
        "folder/metadata/ho_so_EDITOR_DRAFT.json",
    );
});

Deno.test("buildDraftMetadataKey replaces assignment-scoped draft suffix", () => {
    assertEquals(
        buildDraftMetadataKey("folder/metadata/ho_so_EDITOR_DRAFT_old12345.json", "new12345-53be-4db3-a706-af56069a0c40"),
        "folder/metadata/ho_so_EDITOR_DRAFT_new12345.json",
    );
});
