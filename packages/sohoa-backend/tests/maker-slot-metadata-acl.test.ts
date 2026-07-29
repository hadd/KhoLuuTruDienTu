import { assertEquals } from "@std/assert";
import type { DossierMetadata } from "../libs/metadata-types.ts";
import { resolveEffectiveAllowedFields } from "../libs/metadata-permission.ts";

const tt05Metadata: DossierMetadata = {
    metadata_groups: [
        {
            group_code: "HO_SO_LUU_TRU",
            group_name: "Hồ sơ",
            source_document: { file_name: null, file_path: null },
            fields: [
                {
                    name: "FOND",
                    display: "Phông lưu trữ",
                    type: "string",
                    value: "Phông Cục THA DS tỉnh Phú Thọ",
                    page: null,
                    bbox: null,
                },
                {
                    name: "MA_HO_SO",
                    display: "Mã hồ sơ",
                    type: "string",
                    value: "HS-1",
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
    const slotPatterns = ["HO_SO_LUU_TRU.*", "QUYET_DINH.*"];

    const resolved = resolveEffectiveAllowedFields(
        stored,
        slotPatterns,
        tt05Metadata,
    );

    assertEquals(resolved?.includes("HO_SO_LUU_TRU.FOND"), true);
    assertEquals(resolved?.includes("QUYET_DINH.SO_CUA_TAI_LIEU"), true);
    assertEquals(resolved?.includes("BAN_AN_QUYET_DINH.SO_BAN_AN"), false);
});

Deno.test("resolveEffectiveAllowedFields migrates legacy PHONG fond keys", () => {
    const stored = ["PHONG_LUU_TRU.MA_PHONG"];

    const resolved = resolveEffectiveAllowedFields(
        stored,
        null,
        tt05Metadata,
    );

    assertEquals(resolved?.includes("HO_SO_LUU_TRU.FOND"), true);
});

Deno.test("resolveEffectiveAllowedFields maps legacy PHONG_LUU_TRU slot to HO_SO catalog", () => {
    const stored = ["PHONG_LUU_TRU.MA_PHONG"];
    const slotPatterns = ["PHONG_LUU_TRU.*"];

    const resolved = resolveEffectiveAllowedFields(
        stored,
        slotPatterns,
        tt05Metadata,
    );

    assertEquals(resolved?.includes("HO_SO_LUU_TRU.FOND"), true);
    assertEquals(resolved?.includes("HO_SO_LUU_TRU.MA_HO_SO"), true);
});

Deno.test("resolveEffectiveAllowedFields falls back to stored fields when slot expansion is empty", () => {
    const stored = ["HO_SO_LUU_TRU.FOND"];

    const resolved = resolveEffectiveAllowedFields(
        stored,
        ["UNKNOWN_GROUP.*"],
        tt05Metadata,
    );

    assertEquals(resolved?.includes("HO_SO_LUU_TRU.FOND"), true);
});

Deno.test("resolveEffectiveAllowedFields derives wildcards from stored template keys", () => {
    const stored = ["QUYET_DINH.SO_QD_THA", "DUONG_SU.HO_VA_TEN"];

    const resolved = resolveEffectiveAllowedFields(
        stored,
        null,
        tt05Metadata,
    );

    assertEquals(resolved?.includes("QUYET_DINH.SO_CUA_TAI_LIEU"), true);
    assertEquals(resolved?.includes("QUYET_DINH.TEN_LOAI_TAI_LIEU"), true);
    assertEquals(resolved?.some((key) => key.startsWith("DUONG_SU.")), false);
    assertEquals(resolved?.includes("QUYET_DINH.SO_QD_THA"), false);
});

Deno.test("resolveEffectiveAllowedFields returns stored when dossier has no matching catalog", () => {
    const stored = ["UNKNOWN_GROUP.SOME_FIELD"];

    const resolved = resolveEffectiveAllowedFields(
        stored,
        null,
        tt05Metadata,
    );

    assertEquals(resolved, stored);
});

Deno.test("resolveEffectiveAllowedFields returns null when ACL is disabled", () => {
    const resolved = resolveEffectiveAllowedFields(
        null,
        ["HO_SO_LUU_TRU.*"],
        tt05Metadata,
    );

    assertEquals(resolved, null);
});
