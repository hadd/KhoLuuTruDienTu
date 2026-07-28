import { assertEquals, assertFalse } from "@std/assert";
import {
    resolveAllowedFieldsForDossierMetadata,
    validateGroupSlotAssignments,
    validateSlotCoverage,
} from "../libs/metadata-permission.ts";
import type { DossierMetadata } from "../libs/metadata-types.ts";
import type { MetadataFieldCatalogEntry } from "../libs/metadata-template.ts";

const catalog: MetadataFieldCatalogEntry[] = [
    { key: "BAN_AN_QUYET_DINH.SO_BAN_AN", groupCode: "BAN_AN_QUYET_DINH", groupName: "Bản án, quyết định", fieldName: "SO_BAN_AN", display: "Số bản án" },
    { key: "DUONG_SU.HO_VA_TEN", groupCode: "DUONG_SU", groupName: "Đương sự", fieldName: "HO_VA_TEN", display: "Họ và tên" },
    { key: "DUONG_SU.SO_CCCD", groupCode: "DUONG_SU", groupName: "Đương sự", fieldName: "SO_CCCD", display: "Số CCCD" },
    { key: "NGHIA_VU.SO_TIEN", groupCode: "NGHIA_VU", groupName: "Nghĩa vụ thi hành án", fieldName: "SO_TIEN", display: "Số tiền" },
];

Deno.test("validateSlotCoverage accepts full non-overlapping coverage", () => {
    const result = validateSlotCoverage(catalog, [
        { slotCode: "Q1", slotName: "Biên tập 1", fieldKeys: ["BAN_AN_QUYET_DINH.*"] },
        { slotCode: "Q2", slotName: "Biên tập 2", fieldKeys: ["DUONG_SU.HO_VA_TEN", "DUONG_SU.SO_CCCD"] },
        { slotCode: "Q3", slotName: "Biên tập 3", fieldKeys: ["NGHIA_VU.*"] },
    ]);

    assertEquals(result.valid, true);
    assertEquals(result.uncoveredKeys, []);
    assertEquals(result.overlappingKeys, []);
});

Deno.test("validateSlotCoverage rejects overlapping keys", () => {
    const result = validateSlotCoverage(catalog, [
        { slotCode: "Q1", slotName: "Biên tập 1", fieldKeys: ["DUONG_SU.*"] },
        { slotCode: "Q2", slotName: "Biên tập 2", fieldKeys: ["DUONG_SU.HO_VA_TEN", "BAN_AN_QUYET_DINH.*", "NGHIA_VU.*"] },
    ]);

    assertFalse(result.valid);
    assertEquals(result.overlappingKeys.some((item) => item.key === "DUONG_SU.HO_VA_TEN"), true);
});

Deno.test("validateGroupSlotAssignments requires one slot per editor and every slot filled", () => {
    const slots = [{ slotCode: "Q1" }, { slotCode: "Q2" }, { slotCode: "Q3" }];

    const valid = validateGroupSlotAssignments(slots, [
        { slotCode: "Q1", editorIds: ["editor-a"] },
        { slotCode: "Q2", editorIds: ["editor-b", "editor-c"] },
        { slotCode: "Q3", editorIds: ["editor-d"] },
    ]);
    assertEquals(valid.valid, true);

    const duplicate = validateGroupSlotAssignments(slots, [
        { slotCode: "Q1", editorIds: ["editor-a"] },
        { slotCode: "Q2", editorIds: ["editor-a", "editor-b"] },
        { slotCode: "Q3", editorIds: ["editor-d"] },
    ]);
    assertFalse(duplicate.valid);
    assertEquals(duplicate.duplicateEditors, ["editor-a"]);

    const missingSlot = validateGroupSlotAssignments(slots, [
        { slotCode: "Q1", editorIds: ["editor-a"] },
        { slotCode: "Q2", editorIds: ["editor-b"] },
        { slotCode: "Q3", editorIds: [] },
    ]);
    assertFalse(missingSlot.valid);
    assertEquals(missingSlot.uncoveredSlots, ["Q3"]);
});

Deno.test("resolveAllowedFieldsForDossierMetadata expands slot patterns against dossier catalog", () => {
    const metadata: DossierMetadata = {
        metadata_groups: [
            {
                group_code: "PHONG_LUU_TRU",
                group_name: "Phong",
                source_document: { file_name: null, file_path: null },
                fields: [
                    {
                        name: "MA_PHONG",
                        display: "Ma phong",
                        type: "string",
                        value: "A",
                        page: null,
                        bbox: null,
                    },
                ],
            },
            {
                group_code: "TAI_LIEU_LUU_TRU",
                group_name: "Tai lieu",
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

    const expanded = resolveAllowedFieldsForDossierMetadata(
        ["PHONG_LUU_TRU.*", "QUYET_DINH.*"],
        metadata,
    );

    assertEquals(expanded.includes("PHONG_LUU_TRU.MA_PHONG"), true);
    assertEquals(expanded.includes("QUYET_DINH.SO_CUA_TAI_LIEU"), true);
    assertEquals(expanded.some((key) => key.startsWith("BIEN_LAI.")), false);
});
