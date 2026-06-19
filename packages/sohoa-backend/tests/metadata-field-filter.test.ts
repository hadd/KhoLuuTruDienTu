import { assertEquals } from "@std/assert";
import {
    canonicalizeMetadataFields,
    filterMetadataByAllowedFields,
    filterRejectFieldsForAssignment,
    mergePartialMetadata,
    normalizeFieldName,
    rejectFieldMatchesAssignmentScope,
    shouldResetMakerOnReject,
} from "../libs/metadata-field-filter.ts";
import type { DossierMetadata } from "../libs/metadata-types.ts";

const sampleMetadata: DossierMetadata = {
    metadata_groups: [
        {
            group_code: "NHAN_UY_THAC_THA",
            group_name: "Thông báo nhận ủy thác",
            source_document: { file_name: null, file_path: null },
            fields: [
                {
                    name: "SO_THONG_BAO",
                    display: "Số thông báo",
                    type: "string",
                    value: "TB-001",
                    page: null,
                    bbox: null,
                },
                {
                    name: "NGAY_THONG_BAO",
                    display: "Ngày thông báo",
                    type: "string",
                    value: null,
                    page: null,
                    bbox: null,
                },
                {
                    name: "CO_QUAN_THONG_BAO",
                    display: "Cơ quan ra thông báo",
                    type: "string",
                    value: null,
                    page: null,
                    bbox: null,
                },
            ],
        },
    ],
};

Deno.test("filterMetadataByAllowedFields keeps permitted fields with null values", () => {
    const filtered = filterMetadataByAllowedFields(sampleMetadata, [
        "NHAN_UY_THAC_THA.SO_THONG_BAO",
        "NHAN_UY_THAC_THA.NGAY_THONG_BAO",
    ]);

    assertEquals(filtered.metadata_groups.length, 1);
    assertEquals(filtered.metadata_groups[0]!.fields.length, 2);
    assertEquals(filtered.metadata_groups[0]!.fields[0]!.name, "SO_THONG_BAO");
    assertEquals(filtered.metadata_groups[0]!.fields[0]!.value, "TB-001");
    assertEquals(filtered.metadata_groups[0]!.fields[1]!.name, "NGAY_THONG_BAO");
    assertEquals(filtered.metadata_groups[0]!.fields[1]!.value, null);
});

Deno.test("filterMetadataByAllowedFields returns full metadata when allowedFields is null", () => {
    const filtered = filterMetadataByAllowedFields(sampleMetadata, null);
    assertEquals(filtered.metadata_groups[0]!.fields.length, 3);
});

Deno.test("normalizeFieldName strips numeric instance segments", () => {
    assertEquals(normalizeFieldName("_1_HO_VA_TEN"), "HO_VA_TEN");
    assertEquals(normalizeFieldName("SO_PHAI_THU_CHU_DONG_1_TIEU_CHI"), "SO_PHAI_THU_CHU_DONG_TIEU_CHI");
});

Deno.test("canonicalizeMetadataFields keeps duplicate canonical names by index", () => {
    const metadata: DossierMetadata = {
        metadata_groups: [{
            group_code: "DUONG_SU",
            group_name: "Đương sự",
            source_document: { file_name: null, file_path: null },
            fields: [
                { name: "_1_HO_VA_TEN", display: "Họ tên 1", type: "string", value: "A", page: null, bbox: null },
                { name: "_2_HO_VA_TEN", display: "Họ tên 2", type: "string", value: "B", page: null, bbox: null },
            ],
        }],
    };

    const canonical = canonicalizeMetadataFields(metadata);
    assertEquals(canonical.metadata_groups[0]!.fields.map((f) => f.name), ["HO_VA_TEN", "HO_VA_TEN"]);
    assertEquals(canonical.metadata_groups[0]!.fields.map((f) => f.value), ["A", "B"]);
});

Deno.test("mergePartialMetadata merges duplicate canonical fields by index", () => {
    const base: DossierMetadata = {
        metadata_groups: [{
            group_code: "DUONG_SU",
            group_name: "Đương sự",
            source_document: { file_name: null, file_path: null },
            fields: [
                { name: "_1_HO_VA_TEN", display: "Họ tên 1", type: "string", value: "A", page: null, bbox: null },
                { name: "_2_HO_VA_TEN", display: "Họ tên 2", type: "string", value: null, page: null, bbox: null },
            ],
        }],
    };

    const partial: DossierMetadata = {
        metadata_groups: [{
            group_code: "DUONG_SU",
            group_name: "Đương sự",
            source_document: { file_name: null, file_path: null },
            fields: [
                { name: "HO_VA_TEN", display: "Họ tên 1", type: "string", value: "A", page: null, bbox: null },
                { name: "HO_VA_TEN", display: "Họ tên 2", type: "string", value: "Updated B", page: null, bbox: null },
            ],
        }],
    };

    const merged = mergePartialMetadata(base, [partial]);
    assertEquals(merged.metadata_groups[0]!.fields[0]!.value, "A");
    assertEquals(merged.metadata_groups[0]!.fields[1]!.value, "Updated B");
});

Deno.test("mergePartialMetadata replaces OCR field instead of duplicating on single-field partial", () => {
    const base: DossierMetadata = {
        metadata_groups: [{
            group_code: "NHAN_UY_THAC_THA",
            group_name: "Thông báo nhận ủy thác",
            source_document: { file_name: null, file_path: null },
            fields: [
                { name: "SO_THONG_BAO", display: "Số thông báo", type: "string", value: "TB-OLD", page: null, bbox: null },
                { name: "NGAY_THONG_BAO", display: "Ngày thông báo", type: "string", value: null, page: null, bbox: null },
            ],
        }],
    };

    const partial: DossierMetadata = {
        metadata_groups: [{
            group_code: "NHAN_UY_THAC_THA",
            group_name: "Thông báo nhận ủy thác",
            source_document: { file_name: null, file_path: null },
            fields: [
                { name: "SO_THONG_BAO", display: "Số thông báo", type: "string", value: "TB-NEW", page: null, bbox: null },
            ],
        }],
    };

    const merged = mergePartialMetadata(base, [partial]);
    assertEquals(merged.metadata_groups[0]!.fields.length, 2);
    assertEquals(merged.metadata_groups[0]!.fields[0]!.name, "SO_THONG_BAO");
    assertEquals(merged.metadata_groups[0]!.fields[0]!.value, "TB-NEW");
    assertEquals(merged.metadata_groups[0]!.fields[1]!.value, null);
});

Deno.test("mergePartialMetadata merges canonical partial into prefixed OCR field names", () => {
    const base: DossierMetadata = {
        metadata_groups: [{
            group_code: "DUONG_SU",
            group_name: "Đương sự",
            source_document: { file_name: null, file_path: null },
            fields: [
                { name: "_1_HO_VA_TEN", display: "Họ tên", type: "string", value: "Old Name", page: null, bbox: null },
                { name: "_1_SO_CCCD", display: "CCCD", type: "string", value: "123", page: null, bbox: null },
            ],
        }],
    };

    const partial: DossierMetadata = {
        metadata_groups: [{
            group_code: "DUONG_SU",
            group_name: "Đương sự",
            source_document: { file_name: null, file_path: null },
            fields: [
                { name: "HO_VA_TEN", display: "Họ tên", type: "string", value: "New Name", page: null, bbox: null },
            ],
        }],
    };

    const merged = mergePartialMetadata(base, [partial]);
    assertEquals(merged.metadata_groups[0]!.fields.length, 2);
    assertEquals(merged.metadata_groups[0]!.fields[0]!.name, "_1_HO_VA_TEN");
    assertEquals(merged.metadata_groups[0]!.fields[0]!.value, "New Name");
    assertEquals(merged.metadata_groups[0]!.fields[1]!.name, "_1_SO_CCCD");
});

Deno.test("filterMetadataByAllowedFields matches canonical OCR field names", () => {
    const metadata: DossierMetadata = {
        metadata_groups: [{
            group_code: "DUONG_SU",
            group_name: "Đương sự",
            source_document: { file_name: null, file_path: null },
            fields: [
                { name: "_1_HO_VA_TEN", display: "Họ tên", type: "string", value: "A", page: null, bbox: null },
                { name: "_1_SO_CCCD", display: "CCCD", type: "string", value: "123", page: null, bbox: null },
            ],
        }],
    };

    const filtered = filterMetadataByAllowedFields(metadata, ["DUONG_SU.HO_VA_TEN"]);
    assertEquals(filtered.metadata_groups[0]!.fields.length, 1);
    assertEquals(filtered.metadata_groups[0]!.fields[0]!.name, "HO_VA_TEN");
});

Deno.test("rejectFieldMatchesAssignmentScope matches field and group wildcard", () => {
    const slotA = ["NHAN_UY_THAC_THA.SO_THONG_BAO", "NHAN_UY_THAC_THA.NGAY_THONG_BAO"];
    const slotB = ["NHAN_UY_THAC_THA.CO_QUAN_THONG_BAO"];

    assertEquals(
        rejectFieldMatchesAssignmentScope("NHAN_UY_THAC_THA.SO_THONG_BAO", slotA),
        true,
    );
    assertEquals(
        rejectFieldMatchesAssignmentScope("NHAN_UY_THAC_THA.SO_THONG_BAO", slotB),
        false,
    );
    assertEquals(
        rejectFieldMatchesAssignmentScope("NHAN_UY_THAC_THA.*", slotA),
        true,
    );
    assertEquals(
        rejectFieldMatchesAssignmentScope("NHAN_UY_THAC_THA.*", slotB),
        true,
    );
    assertEquals(rejectFieldMatchesAssignmentScope("OTHER.FIELD", null), true);
});

Deno.test("filterRejectFieldsForAssignment returns scoped subset per editor", () => {
    const slotA = ["NHAN_UY_THAC_THA.SO_THONG_BAO", "NHAN_UY_THAC_THA.NGAY_THONG_BAO"];
    const slotB = ["NHAN_UY_THAC_THA.CO_QUAN_THONG_BAO"];
    const rejectFields = [
        "NHAN_UY_THAC_THA.SO_THONG_BAO",
        "NHAN_UY_THAC_THA.CO_QUAN_THONG_BAO",
    ];

    assertEquals(filterRejectFieldsForAssignment(rejectFields, slotA), [
        "NHAN_UY_THAC_THA.SO_THONG_BAO",
    ]);
    assertEquals(filterRejectFieldsForAssignment(rejectFields, slotB), [
        "NHAN_UY_THAC_THA.CO_QUAN_THONG_BAO",
    ]);
    assertEquals(filterRejectFieldsForAssignment(rejectFields, null), rejectFields);
});

Deno.test("shouldResetMakerOnReject resets all makers when reject_fields omitted", () => {
    assertEquals(shouldResetMakerOnReject(["GROUP.FIELD"], null), true);
    assertEquals(shouldResetMakerOnReject(null, null), true);
});

Deno.test("shouldResetMakerOnReject skips editors outside reject scope", () => {
    const slotB = ["NHAN_UY_THAC_THA.CO_QUAN_THONG_BAO"];
    assertEquals(
        shouldResetMakerOnReject(slotB, ["NHAN_UY_THAC_THA.SO_THONG_BAO"]),
        false,
    );
    assertEquals(
        shouldResetMakerOnReject(slotB, ["NHAN_UY_THAC_THA.CO_QUAN_THONG_BAO"]),
        true,
    );
});
