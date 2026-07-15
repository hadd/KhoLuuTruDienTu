import { assertEquals } from "@std/assert";
import { flattenOcrFields } from "../libs/flatten-ocr-fields.ts";
import type { DossierMetadata } from "../libs/metadata-types.ts";

Deno.test("flattenOcrFields gộp nhiều group/file thành fields phẳng", () => {
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
                        name: "SO_BAN_AN",
                        display: "Số bản án",
                        type: "string",
                        value: "87/2023/HS-ST",
                        page: 1,
                        bbox: [488.0, 1214.0, 2239.0, 1302.0],
                    },
                    {
                        name: "NGAY_BAN_HANH_AN_QD",
                        display: "Ngày ban hành án/Quyết định",
                        type: "string",
                        value: "20/09/2023",
                        page: null,
                        bbox: null,
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
                group_code: "QUYET_DINH",
                group_name: "Quyết định THA",
                source_document: {
                    file_name: "CD_218_2023_002.pdf",
                    file_path: "raw/218_CD/CD_218_2023_002.pdf",
                },
                fields: [
                    {
                        name: "SO_QD_THA",
                        display: "Số quyết định THA",
                        type: "string",
                        value: "218/QĐ-CTHADS",
                        page: 1,
                        bbox: [380.0, 438.0, 987.0, 523.0],
                    },
                    {
                        name: "CO_QUAN_BAN_HANH_QUYET_DINH",
                        display: "Cơ quan ban hành quyết định",
                        type: "string",
                        value: "CỤC THI HÀNH ÁN DÂN SỰ TỈNH PHÚ THỌ",
                        page: 1,
                        bbox: [321.0, 263.0, 1046.0, 337.0],
                    },
                ],
            },
        ],
    };

    const fields = flattenOcrFields(metadata);

    assertEquals(fields.length, 4);
    assertEquals(fields[0], {
        file_name: "CD_218_2023_001.pdf",
        file_path: "raw/218_CD/CD_218_2023_001.pdf",
        group_code: "BAN_AN_QUYET_DINH",
        group_name: "Bản án, quyết định",
        name: "SO_BAN_AN",
        display: "Số bản án",
        type: "string",
        value: "87/2023/HS-ST",
        page: 1,
        bbox: [488.0, 1214.0, 2239.0, 1302.0],
    });
    assertEquals(fields[1].name, "NGAY_BAN_HANH_AN_QD");
    assertEquals(fields[1].page, null);
    assertEquals(fields[1].bbox, null);
    assertEquals(fields[2], {
        file_name: "CD_218_2023_002.pdf",
        file_path: "raw/218_CD/CD_218_2023_002.pdf",
        group_code: "QUYET_DINH",
        group_name: "Quyết định THA",
        name: "SO_QD_THA",
        display: "Số quyết định THA",
        type: "string",
        value: "218/QĐ-CTHADS",
        page: 1,
        bbox: [380.0, 438.0, 987.0, 523.0],
    });
    assertEquals(fields[3].group_code, "QUYET_DINH");
    assertEquals(fields[3].value, "CỤC THI HÀNH ÁN DÂN SỰ TỈNH PHÚ THỌ");
});
