import { assertEquals } from "@std/assert";
import { flattenOcrFields } from "../libs/flatten-ocr-fields.ts";
import type { DossierMetadata } from "../libs/metadata-types.ts";

Deno.test("flattenOcrFields denormalizes group metadata onto each field", () => {
    const metadata: DossierMetadata = {
        ho_so_id: "218_CD",
        trang_thai_ho_so: "Thi hành xong",
        metadata_groups: [
            {
                group_code: "BAN_AN_QUYET_DINH",
                group_name: "Bản án, quyết định",
                source_document: {
                    file_name: "CD_218_2023_001.pdf",
                    file_path: "raw/218_CD/CD_218_2023_001.pdf",
                },
                fields: [
                    {
                        name: "CO_QUAN_BAN_HANH",
                        display: "Cơ quan ban hành",
                        type: "string",
                        value: "Tòa án nhân dân tỉnh Phú Thọ",
                        page: 1,
                        bbox: [487.0, 325.0, 902.0, 399.0],
                    },
                    {
                        name: "EMPTY",
                        display: "Empty",
                        type: "string",
                        value: null,
                        page: null,
                        bbox: null,
                    },
                ],
            },
            {
                group_code: "DUONG_SU",
                group_name: "Đương sự",
                source_document: {
                    file_name: "CD_218_2023_001.pdf",
                    file_path: "raw/218_CD/CD_218_2023_001.pdf",
                },
                fields: [
                    {
                        name: "_1_HO_VA_TEN",
                        display: "Họ và tên 1",
                        type: "string",
                        value: "Lê Thị Minh Ánh",
                        page: 1,
                        bbox: [488.0, 1572.0, 2077.0, 1649.0],
                    },
                ],
            },
        ],
    };

    const fields = flattenOcrFields(metadata);

    assertEquals(fields.length, 2);
    assertEquals(fields[0], {
        group_code: "BAN_AN_QUYET_DINH",
        group_name: "Bản án, quyết định",
        file_name: "CD_218_2023_001.pdf",
        file_path: "raw/218_CD/CD_218_2023_001.pdf",
        name: "CO_QUAN_BAN_HANH",
        display: "Cơ quan ban hành",
        value: "Tòa án nhân dân tỉnh Phú Thọ",
        page: 1,
        bbox: [487.0, 325.0, 902.0, 399.0],
    });
    assertEquals(fields[1].group_code, "DUONG_SU");
    assertEquals(fields[1].value, "Lê Thị Minh Ánh");
    assertEquals(fields[1].page, 1);
    assertEquals(fields[1].bbox, [488.0, 1572.0, 2077.0, 1649.0]);
});
