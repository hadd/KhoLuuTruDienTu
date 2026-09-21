import { assertEquals, assertThrows } from "@std/assert";
import {
    buildDocumentNamePreview,
    buildDocumentNamePreviewSamples,
    validateDocumentNamingSegments,
    type DocumentNamingSegment,
} from "../libs/document-naming-types.ts";
import { mergeMetadataNamingFieldOptions } from "../libs/document-naming-export.ts";
import { buildUnionExportFieldCatalog } from "../libs/metadata-export-field-resolver.ts";
import type { DossierMetadata } from "../libs/metadata-types.ts";

Deno.test("validateDocumentNamingSegments - rejects metadata_field without fieldKey", () => {
    const invalidSegments: DocumentNamingSegment[] = [
        { length: 4, source: "metadata_field", fieldKey: "" },
    ];
    assertThrows(() => validateDocumentNamingSegments(invalidSegments));
});

Deno.test("validateDocumentNamingSegments - accepts valid metadata_field", () => {
    const validSegments: DocumentNamingSegment[] = [
        { length: 4, source: "metadata_field", fieldKey: "HO_SO_LUU_TRU.MUC_LUC_SO", padChar: "0" },
    ];
    validateDocumentNamingSegments(validSegments);
});

Deno.test("buildDocumentNamePreview - generates full file name according to user requirement", () => {
    const segments: DocumentNamingSegment[] = [
        // 1. Mã Phông (3 số, bù 0)
        { length: 3, source: "fond_field", fieldKey: "id", padChar: "0" },
        // Dấu gạch ngang
        { length: 1, source: "fixed", value: "-" },
        // 2. Mục lục số (2 số, bù 0)
        { length: 2, source: "metadata_field", fieldKey: "HO_SO_LUU_TRU.MUC_LUC_SO", padChar: "0" },
        // Dấu gạch ngang
        { length: 1, source: "fixed", value: "-" },
        // 3. Đơn vị bảo quản số (4 số, bù 0)
        { length: 4, source: "metadata_field", fieldKey: "HO_SO_LUU_TRU.MA_HO_SO", padChar: "0" },
        // Dấu gạch ngang
        { length: 1, source: "fixed", value: "-" },
        // 4. Số thứ tự tài liệu (3 số, bù 0)
        { length: 3, source: "auto_increment", value: "1", padChar: "0" },
        // Dấu gạch ngang
        { length: 1, source: "fixed", value: "-" },
        // 5. Ký hiệu thể loại văn bản (BC)
        { length: 2, source: "metadata_field", fieldKey: "TAI_LIEU_LUU_TRU.TEN_LOAI_TAI_LIEU" },
        // Dấu gạch ngang
        { length: 1, source: "fixed", value: "-" },
        // 6. Số văn bản (4 số, bù 0)
        { length: 4, source: "metadata_field", fieldKey: "TAI_LIEU_LUU_TRU.SO_CUA_VAN_BAN", padChar: "0" },
        // Dấu gạch ngang
        { length: 1, source: "fixed", value: "-" },
        // 7. Năm phát hành (4 số)
        { length: 4, source: "metadata_field", fieldKey: "TAI_LIEU_LUU_TRU.NAM" },
        // Đuôi .pdf
        { length: 4, source: "fixed", value: ".pdf" },
    ];

    const result = buildDocumentNamePreview({
        segments,
        fond: { id: "11" },
        metadataValues: {
            "HO_SO_LUU_TRU.MUC_LUC_SO": "7",
            "HO_SO_LUU_TRU.MA_HO_SO": "123",
            "TAI_LIEU_LUU_TRU.TEN_LOAI_TAI_LIEU": "BC",
            "TAI_LIEU_LUU_TRU.SO_CUA_VAN_BAN": "1",
            "TAI_LIEU_LUU_TRU.NAM": "1998",
        },
        autoIncrementCounter: 1,
    });

    assertEquals(result, "011-07-0123-001-BC-0001-1998.pdf");
});

Deno.test("buildDocumentNamePreview - handles ĐVBQ with suffix a, b (e.g. 123a -> 0123a)", () => {
    const segments: DocumentNamingSegment[] = [
        { length: 4, source: "metadata_field", fieldKey: "HO_SO_LUU_TRU.MA_HO_SO", padChar: "0" },
    ];

    const result = buildDocumentNamePreview({
        segments,
        metadataValues: {
            "HO_SO_LUU_TRU.MA_HO_SO": "123a",
        },
    });

    assertEquals(result, "0123a");
});

Deno.test("buildDocumentNamePreview - metadata_field with empty metadata value resolves to empty string without label fallback", () => {
    const segments: DocumentNamingSegment[] = [
        {
            length: 1,
            source: "metadata_field",
            fieldKey: "HO_SO_LUU_TRU.MA_PHONG",
            value: "Mã phông",
            padChar: null,
        },
    ];

    const result = buildDocumentNamePreview({
        segments,
        metadataValues: {
            "HO_SO_LUU_TRU.MA_PHONG": "",
        },
    });

    // Must return "" (empty string) and NOT fall back to label "Mã phông"
    assertEquals(result, "");
});

Deno.test("buildDocumentNamePreview - does not pad with spaces when padChar is omitted or null", () => {
    const segments: DocumentNamingSegment[] = [
        {
            length: 5,
            source: "metadata_field",
            fieldKey: "TAI_LIEU_LUU_TRU.TEN_LOAI_TAI_LIEU",
            padChar: null,
        },
    ];

    const result = buildDocumentNamePreview({
        segments,
        metadataValues: {
            "TAI_LIEU_LUU_TRU.TEN_LOAI_TAI_LIEU": "BC",
        },
    });

    // Must NOT pad to "   BC" with spaces
    assertEquals(result, "BC");
});

Deno.test("buildDocumentNamePreviewSamples - generates non-empty preview samples for metadata segments", () => {
    const segments: DocumentNamingSegment[] = [
        {
            length: 1,
            source: "metadata_field",
            fieldKey: "HO_SO_LUU_TRU.MA_PHONG",
            value: "Mã phông",
        },
    ];

    const samples = buildDocumentNamePreviewSamples({
        segments,
        metadataValues: {
            "HO_SO_LUU_TRU.MA_PHONG": "P00005",
        },
    });

    assertEquals(samples.length, 1);
    assertEquals(samples[0], "P00005");
});

Deno.test("DocumentNamingConfigService.resolvePreviewMetadataValues - resolves fond ID and mock metadata for metadata_field segments without dossier", async () => {
    const { DocumentNamingConfigService } = await import(
        "../modules/document-naming-config/document-naming-config-service.ts"
    );

    const segments: DocumentNamingSegment[] = [
        {
            length: 1,
            source: "metadata_field",
            fieldKey: "HO_SO_LUU_TRU.MA_PHONG",
            value: "Mã phông",
        },
        {
            length: 1,
            source: "metadata_field",
            fieldKey: "HO_SO_LUU_TRU.THOI_HAN_LUU_TRU",
            value: "Thời hạn lưu trữ",
        },
        {
            length: 1,
            source: "metadata_field",
            fieldKey: "UNKNOWN.CUSTOM_FIELD",
            value: "Trường tùy biến",
        },
    ];

    const values = await DocumentNamingConfigService.resolvePreviewMetadataValues(
        { id: "P00099", fondName: "Phông 99" } as any,
        null,
        segments,
    );

    // Fond field must use fond ID
    assertEquals(values["HO_SO_LUU_TRU.MA_PHONG"], "P00099");
    // Standard field must have realistic mock value
    assertEquals(values["HO_SO_LUU_TRU.THOI_HAN_LUU_TRU"], "Vĩnh viễn");
    // Custom field must fall back to segment value
    assertEquals(values["UNKNOWN.CUSTOM_FIELD"], "Trường tùy biến");

    // Preview samples generated with these values must NOT be empty or a space
    const previewSamples = buildDocumentNamePreviewSamples({
        segments: [segments[0]],
        fond: { id: "P00099" },
        metadataValues: values,
    });
    assertEquals(previewSamples, ["P00099"]);
});

Deno.test("mergeMetadataNamingFieldOptions - returns only liveCatalog when live metadata is present", () => {
    const liveCatalog = [
        { key: "HO_SO_LUU_TRU.MA_HO_SO", display: "Mã hồ sơ", groupName: "Metadata cấp Hồ sơ" },
        { key: "HO_SO_LUU_TRU.TIEU_DE_HO_SO", display: "Tiêu đề hồ sơ", groupName: "Metadata cấp Hồ sơ" },
    ];

    const result = mergeMetadataNamingFieldOptions(liveCatalog);
    assertEquals(result.length, 2);
    assertEquals(result[0].key, "HO_SO_LUU_TRU.MA_HO_SO");
    assertEquals(result[1].key, "HO_SO_LUU_TRU.TIEU_DE_HO_SO");
});

Deno.test("mergeMetadataNamingFieldOptions - falls back to full static template when liveCatalog is empty", () => {
    const result = mergeMetadataNamingFieldOptions([]);
    // Must return full fallback TT05 fields (at least 10 items)
    assertEquals(result.length > 5, true);
    assertEquals(result.some((r) => r.key === "HO_SO_LUU_TRU.MUC_LUC_SO"), true);
});

Deno.test("buildUnionExportFieldCatalog - correctly sets sampleValue and hasValue", () => {
    const mockMetadata: DossierMetadata[] = [
        {
            ho_so_id: "test-dossier",
            metadata_groups: [
                {
                    group_code: "HO_SO_LUU_TRU",
                    group_name: "Metadata cấp Hồ sơ",
                    source_document: { file_name: "test.pdf", file_path: "/test.pdf" },
                    fields: [
                        { name: "MA_HO_SO", display: "Mã hồ sơ", value: "HS-001", type: "string", page: 1, bbox: [] },
                        { name: "MUC_LUC_SO", display: "Mục lục số hoặc năm hình thành hồ sơ", value: "", type: "string", page: 1, bbox: [] },
                        { name: "GHI_CHU", display: "Ghi chú", value: null, type: "string", page: 1, bbox: [] },
                    ],
                },
            ],
        },
    ];

    const catalog = buildUnionExportFieldCatalog(mockMetadata);
    const maHoSo = catalog.find((c) => c.key === "HO_SO_LUU_TRU.MA_HO_SO");
    const mucLucSo = catalog.find((c) => c.key === "HO_SO_LUU_TRU.MUC_LUC_SO");
    const ghiChu = catalog.find((c) => c.key === "HO_SO_LUU_TRU.GHI_CHU");

    assertEquals(maHoSo?.hasValue, true);
    assertEquals(maHoSo?.sampleValue, "HS-001");

    assertEquals(mucLucSo?.hasValue, false);
    assertEquals(mucLucSo?.sampleValue, null);

    assertEquals(ghiChu?.hasValue, false);
    assertEquals(ghiChu?.sampleValue, null);
});

