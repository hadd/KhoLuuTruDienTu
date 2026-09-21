import { assertEquals, assertThrows } from "@std/assert";
import {
    buildDocumentNamePreview,
    buildDocumentNamePreviewSamples,
    validateDocumentNamingSegments,
    type DocumentNamingSegment,
} from "../libs/document-naming-types.ts";

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
