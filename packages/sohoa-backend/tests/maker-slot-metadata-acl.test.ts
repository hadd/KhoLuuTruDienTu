import { assertEquals } from "@std/assert";
import type { DossierMetadata } from "../libs/metadata-types.ts";
import { resolveEffectiveAllowedFields } from "../libs/metadata-permission.ts";

const tt05Metadata: DossierMetadata = {
    metadata_groups: [
        {
            group_code: "PHONG_LUU_TRU",
            group_name: "Phông",
            source_document: { file_name: null, file_path: null },
            fields: [
                {
                    name: "MA_PHONG",
                    display: "Mã phông",
                    type: "string",
                    value: "THADS_PT",
                    page: null,
                    bbox: null,
                },
            ],
        },
        {
            group_code: "TAI_LIEU_LUU_TRU",
            group_name: "Tài liệu",
            source_document: { file_name: null, file_path: null },
            fields: [],
            documents: [
                {
                    source_document: {
                        file_name: "document_1.pdf",
                        file_path: "raw/test/document_1.pdf",
                    },
                    fields: [
                        {
                            name: "TEN_LOAI_TAI_LIEU",
                            display: "Tên loại tài liệu",
                            type: "string",
                            value: "Quyết định",
                            page: null,
                            bbox: null,
                        },
                        {
                            name: "SO_CUA_TAI_LIEU",
                            display: "Số của tài liệu",
                            type: "string",
                            value: "218",
                            page: null,
                            bbox: null,
                        },
                    ],
                },
            ],
        },
    ],
};

Deno.test("resolveEffectiveAllowedFields expands slot patterns against dossier catalog", () => {
    const stored = ["BAN_AN_QUYET_DINH.SO_BAN_AN", "NGHIA_VU.LOAI_NGHIA_VU"];
    const slotPatterns = ["PHONG_LUU_TRU.*", "QUYET_DINH.*"];

    const resolved = resolveEffectiveAllowedFields(
        stored,
        slotPatterns,
        tt05Metadata,
    );

    assertEquals(resolved?.includes("PHONG_LUU_TRU.MA_PHONG"), true);
    assertEquals(resolved?.includes("QUYET_DINH.SO_CUA_TAI_LIEU"), true);
    assertEquals(resolved?.includes("BAN_AN_QUYET_DINH.SO_BAN_AN"), false);
});

Deno.test("resolveEffectiveAllowedFields falls back to stored fields when slot expansion is empty", () => {
    const stored = ["PHONG_LUU_TRU.MA_PHONG"];

    const resolved = resolveEffectiveAllowedFields(
        stored,
        ["UNKNOWN_GROUP.*"],
        tt05Metadata,
    );

    assertEquals(resolved, stored);
});

Deno.test("resolveEffectiveAllowedFields returns null when ACL is disabled", () => {
    const resolved = resolveEffectiveAllowedFields(
        null,
        ["PHONG_LUU_TRU.*"],
        tt05Metadata,
    );

    assertEquals(resolved, null);
});
