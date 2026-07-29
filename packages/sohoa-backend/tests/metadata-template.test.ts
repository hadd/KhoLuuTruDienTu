import { assertEquals } from "@std/assert";
import { enrichFieldCatalogWithGroupNames, extractFieldCatalog } from "../libs/metadata-template.ts";
import type { DossierMetadata } from "../libs/metadata-types.ts";

const sampleMetadata: DossierMetadata = {
    metadata_groups: [
        {
            group_code: "DUONG_SU",
            group_name: "Đương sự",
            source_document: { file_name: null, file_path: null },
            fields: [
                { name: "HO_VA_TEN", display: "Họ và tên", type: "text", value: null, page: null, bbox: null },
                { name: "SO_CCCD", display: "Số CCCD", type: "text", value: null, page: null, bbox: null },
            ],
        },
        {
            group_code: "BAN_AN_QUYET_DINH",
            group_name: "Bản án, quyết định",
            source_document: { file_name: null, file_path: null },
            fields: [
                { name: "SO_BAN_AN", display: "Số bản án", type: "text", value: null, page: null, bbox: null },
            ],
        },
    ],
};

Deno.test("enrichFieldCatalogWithGroupNames fills missing groupName", () => {
    const catalog = extractFieldCatalog(sampleMetadata).map(({ groupName: _groupName, ...entry }) => entry);
    const enriched = enrichFieldCatalogWithGroupNames(catalog, sampleMetadata);

    assertEquals(enriched[0]?.groupName, "Đương sự");
    assertEquals(enriched[2]?.groupName, "Bản án, quyết định");
});

Deno.test("extractFieldCatalog saves groupName from group_name", () => {
    const catalog = extractFieldCatalog(sampleMetadata);

    assertEquals(catalog.length, 3);
    assertEquals(catalog[0], {
        key: "DUONG_SU.HO_VA_TEN",
        groupCode: "DUONG_SU",
        groupName: "Đương sự",
        fieldName: "HO_VA_TEN",
        display: "Họ và tên",
    });
    assertEquals(catalog[2], {
        key: "BAN_AN_QUYET_DINH.SO_BAN_AN",
        groupCode: "BAN_AN_QUYET_DINH",
        groupName: "Bản án, quyết định",
        fieldName: "SO_BAN_AN",
        display: "Số bản án",
    });
});

Deno.test("extractFieldCatalog expands TT05 TAI_LIEU_LUU_TRU documents[]", () => {
    const tt05Metadata: DossierMetadata = {
        metadata_groups: [
            {
                group_code: "HO_SO_LUU_TRU",
                group_name: "Metadata cấp Hồ sơ lưu trữ",
                source_document: { file_name: null, file_path: null },
                fields: [
                    { name: "MA_HO_SO", display: "Mã hồ sơ", type: "string", value: null, page: null, bbox: null },
                ],
            },
            {
                group_code: "TAI_LIEU_LUU_TRU",
                group_name: "Metadata cấp Tài liệu lưu trữ",
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
                                value: null,
                                page: null,
                                bbox: null,
                            },
                        ],
                    },
                ],
            },
        ],
    };

    const catalog = extractFieldCatalog(tt05Metadata);

    assertEquals(catalog.some((entry) => entry.key === "HO_SO_LUU_TRU.MA_HO_SO"), true);
    assertEquals(catalog.some((entry) => entry.key === "QUYET_DINH.SO_CUA_TAI_LIEU"), true);
    assertEquals(
        catalog.find((entry) => entry.key === "QUYET_DINH.SO_CUA_TAI_LIEU"),
        {
            key: "QUYET_DINH.SO_CUA_TAI_LIEU",
            groupCode: "QUYET_DINH",
            groupName: "Quyết định",
            fieldName: "SO_CUA_TAI_LIEU",
            display: "Số của tài liệu",
        },
    );
});
