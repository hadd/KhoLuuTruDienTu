import { assertEquals } from "@std/assert";
import { filterMetadataByAllowedFields } from "../libs/metadata-field-filter.ts";
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
