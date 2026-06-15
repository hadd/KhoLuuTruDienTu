import { assertEquals } from "@std/assert";
import { computeFieldDiff, normalizeFieldValue } from "../modules/metadata-history/metadata-history-diff.ts";
import { shouldRecordMetadataSnapshot } from "../modules/metadata-history/metadata-history-policy.ts";
import type { DossierMetadata } from "../libs/metadata-types.ts";

function sampleMetadata(overrides: Partial<DossierMetadata> = {}): DossierMetadata {
    return {
        ho_so_id: "185_CD",
        metadata_groups: [{
            group_code: "BAN_AN",
            group_name: "Bản án",
            source_document: { file_name: "a.pdf", file_path: "raw/a.pdf" },
            fields: [
                { name: "SO_BAN_AN", display: "Số", type: "string", value: "50/2022", page: 1, bbox: null },
                { name: "NGAY", display: "Ngày", type: "string", value: "14/12/2022", page: null, bbox: null },
            ],
        }],
        ...overrides,
    };
}

Deno.test("normalizeFieldValue stringifies non-string values", () => {
    assertEquals(normalizeFieldValue(null), null);
    assertEquals(normalizeFieldValue("abc"), "abc");
    assertEquals(normalizeFieldValue(123), "123");
    assertEquals(normalizeFieldValue({ a: 1 }), "{\"a\":1}");
});

Deno.test("computeFieldDiff returns null when metadata is identical", () => {
    const meta = sampleMetadata();
    assertEquals(computeFieldDiff(meta, sampleMetadata()), null);
});

Deno.test("computeFieldDiff detects changed field values", () => {
    const oldMeta = sampleMetadata();
    const newMeta = sampleMetadata({
        metadata_groups: [{
            group_code: "BAN_AN",
            group_name: "Bản án",
            source_document: { file_name: "a.pdf", file_path: "raw/a.pdf" },
            fields: [
                { name: "SO_BAN_AN", display: "Số", type: "string", value: "51/2023", page: 1, bbox: null },
                { name: "NGAY", display: "Ngày", type: "string", value: "14/12/2022", page: null, bbox: null },
            ],
        }],
    });

    assertEquals(computeFieldDiff(oldMeta, newMeta), {
        "BAN_AN.SO_BAN_AN": { old: "50/2022", new: "51/2023" },
    });
});

Deno.test("computeFieldDiff detects removed fields", () => {
    const oldMeta = sampleMetadata();
    const newMeta = sampleMetadata({
        metadata_groups: [{
            group_code: "BAN_AN",
            group_name: "Bản án",
            source_document: { file_name: "a.pdf", file_path: "raw/a.pdf" },
            fields: [
                { name: "SO_BAN_AN", display: "Số", type: "string", value: "50/2022", page: 1, bbox: null },
            ],
        }],
    });

    assertEquals(computeFieldDiff(oldMeta, newMeta), {
        "BAN_AN.NGAY": { old: "14/12/2022", new: null },
    });
});

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
