import { assertEquals } from "@std/assert";
import { shouldRecordMetadataSnapshot } from "../modules/metadata-history/metadata-history-policy.ts";

Deno.test("shouldRecordMetadataSnapshot always records OCR and restore", () => {
    assertEquals(
        shouldRecordMetadataSnapshot({
            action: "OCR_COMPLETED",
            fieldChanges: null,
            diffComputed: false,
        }),
        true,
    );
    assertEquals(
        shouldRecordMetadataSnapshot({
            action: "RESTORE_VERSION",
            fieldChanges: null,
            diffComputed: false,
        }),
        true,
    );
});

Deno.test("shouldRecordMetadataSnapshot skips workflow actions without field changes", () => {
    assertEquals(
        shouldRecordMetadataSnapshot({
            action: "QC_CHECKER_1_APPROVE",
            fieldChanges: null,
            diffComputed: true,
        }),
        false,
    );
    assertEquals(
        shouldRecordMetadataSnapshot({
            action: "SUBMIT_ENTRY",
            fieldChanges: null,
            diffComputed: true,
        }),
        false,
    );
});

Deno.test("shouldRecordMetadataSnapshot records workflow actions with field changes", () => {
    assertEquals(
        shouldRecordMetadataSnapshot({
            action: "QC_CHECKER_1_APPROVE",
            fieldChanges: { "group.field": { old: "a", new: "b" } },
            diffComputed: true,
        }),
        true,
    );
});

Deno.test("shouldRecordMetadataSnapshot skips when diff could not be computed", () => {
    assertEquals(
        shouldRecordMetadataSnapshot({
            action: "QC_CHECKER_1_APPROVE",
            fieldChanges: null,
            diffComputed: false,
        }),
        false,
    );
});
