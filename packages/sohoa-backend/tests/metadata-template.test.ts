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
