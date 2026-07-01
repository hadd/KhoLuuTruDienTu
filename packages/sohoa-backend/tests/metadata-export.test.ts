import { assertEquals } from "@std/assert";
import {
    buildDefaultExportConfig,
    resolveExportColumnValue,
    resolveExportFieldValue,
} from "../libs/metadata-export-field-resolver.ts";
import { buildDynamicMetadataExcel } from "../libs/metadata-excel-export.ts";
import { buildMetadataExportPreview } from "../libs/metadata-export-preview.ts";
import type { DossierMetadata } from "../libs/metadata-types.ts";

const sampleMetadata: DossierMetadata = {
    metadata_groups: [
        {
            group_code: "DUONG_SU",
            group_name: "Đương sự",
            source_document: { file_name: null, file_path: null },
            fields: [
                {
                    name: "_1_HO_VA_TEN",
                    display: "Họ và tên 1",
                    type: "string",
                    value: "Nguyễn Văn A",
                    page: null,
                    bbox: null,
                },
                {
                    name: "_2_HO_VA_TEN",
                    display: "Họ và tên 2",
                    type: "string",
                    value: "Trần Thị B",
                    page: null,
                    bbox: null,
                },
                {
                    name: "SO_CCCD",
                    display: "Số CCCD",
                    type: "string",
                    value: "001122334455",
                    page: null,
                    bbox: null,
                },
            ],
        },
    ],
};

Deno.test("resolveExportFieldValue joins instances with newline", () => {
    const value = resolveExportFieldValue(sampleMetadata, "DUONG_SU.HO_VA_TEN");
    assertEquals(value, "Nguyễn Văn A\nTrần Thị B");
});

Deno.test("resolveExportColumnValue merges fields with separator", () => {
    const value = resolveExportColumnValue(sampleMetadata, {
        header: "Thông tin",
        fieldKeys: ["DUONG_SU.HO_VA_TEN", "DUONG_SU.SO_CCCD"],
        separator: " | ",
    });
    assertEquals(value, "Nguyễn Văn A\nTrần Thị B | 001122334455");
});

Deno.test("buildDefaultExportConfig prepends STT and uses normalized display headers", () => {
    const columns = buildDefaultExportConfig([sampleMetadata]);
    assertEquals(columns.length, 3);
    assertEquals(columns[0]?.header, "STT");
    assertEquals(columns[0]?.fieldKeys, []);
    assertEquals(columns[1]?.header, "Họ và tên");
    assertEquals(columns[1]?.fieldKeys, ["DUONG_SU.HO_VA_TEN"]);
    assertEquals(columns[2]?.header, "Số CCCD");
});

Deno.test("resolveExportFieldValue merges indexed instances by canonical name", () => {
    const metadata: DossierMetadata = {
        metadata_groups: [{
            group_code: "DUONG_SU",
            group_name: "Đương sự",
            source_document: { file_name: null, file_path: null },
            fields: [
                {
                    name: "_1_SO_CCCD",
                    display: "Số CCCD 1",
                    type: "string",
                    value: "111",
                    page: null,
                    bbox: null,
                },
                {
                    name: "_2_SO_CCCD",
                    display: "Số CCCD 2",
                    type: "string",
                    value: "222",
                    page: null,
                    bbox: null,
                },
            ],
        }],
    };

    assertEquals(resolveExportFieldValue(metadata, "DUONG_SU.SO_CCCD"), "111\n222");
});

Deno.test("resolveExportColumnValue fills STT from row number", () => {
    const stt = resolveExportColumnValue(sampleMetadata, {
        header: "STT",
        fieldKeys: [],
        separator: "",
    }, { rowNumber: 3 });
    assertEquals(stt, "3");
});

Deno.test("buildDynamicMetadataExcel creates workbook bytes", async () => {
    const buffer = await buildDynamicMetadataExcel([sampleMetadata]);
    assertEquals(buffer.byteLength > 0, true);
});

Deno.test("buildMetadataExportPreview returns headers and row cells", () => {
    const preview = buildMetadataExportPreview([sampleMetadata], {
        columns: [
            {
                header: "Họ tên",
                fieldKeys: ["DUONG_SU.HO_VA_TEN"],
                separator: ", ",
            },
            {
                header: "CCCD",
                fieldKeys: ["DUONG_SU.SO_CCCD"],
                separator: ", ",
            },
        ],
    });

    assertEquals(preview.headers, ["Họ tên", "CCCD"]);
    assertEquals(preview.totalCount, 1);
    assertEquals(preview.previewCount, 1);
    assertEquals(preview.rows[0]?.cells[0], "Nguyễn Văn A\nTrần Thị B");
    assertEquals(preview.rows[0]?.cells[1], "001122334455");
});
