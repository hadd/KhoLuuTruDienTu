import { assertEquals } from "@std/assert";
import ExcelJS from "exceljs";
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

Deno.test("buildDynamicMetadataExcel expands multi-file dossier into rows with merged dossier metadata", async () => {
    const ExcelJS = (await import("exceljs")).default;

    const multiFileTt05Metadata: DossierMetadata = {
        ho_so_id: "HS_MERGE_TEST",
        metadata_groups: [
            {
                group_code: "HO_SO_LUU_TRU",
                group_name: "Metadata cấp Hồ sơ lưu trữ",
                source_document: { file_name: "bia.pdf", file_path: "raw/bia.pdf" },
                fields: [
                    { name: "MA_HO_SO", display: "Mã hồ sơ", type: "string", value: "HS-999_TEST", page: null, bbox: null },
                    { name: "TIEU_DE_HO_SO", display: "Tiêu đề hồ sơ", type: "string", value: "Hồ sơ kiểm thử merge file", page: null, bbox: null },
                ],
            },
            {
                group_code: "TAI_LIEU_LUU_TRU",
                group_name: "Metadata cấp Tài liệu lưu trữ",
                source_document: { file_name: "doc_1.pdf", file_path: "raw/doc_1.pdf" },
                fields: [
                    { name: "MA_DINH_DANH_TAI_LIEU", display: "Mã định danh tài liệu", type: "string", value: "TL-001", page: null, bbox: null },
                    { name: "TEN_LOAI_TAI_LIEU", display: "Tên loại tài liệu", type: "string", value: "Quyết định", page: null, bbox: null },
                    { name: "SO_CUA_TAI_LIEU", display: "Số của tài liệu", type: "string", value: "101", page: null, bbox: null },
                    { name: "NGAY_THANG_NAM_BAN_HANH", display: "Ngày tháng năm ban hành", type: "string", value: "2024-05-10", page: null, bbox: null },
                ],
            },
            {
                group_code: "TAI_LIEU_LUU_TRU",
                group_name: "Metadata cấp Tài liệu lưu trữ",
                source_document: { file_name: "doc_2.pdf", file_path: "raw/doc_2.pdf" },
                fields: [
                    { name: "MA_DINH_DANH_TAI_LIEU", display: "Mã định danh tài liệu", type: "string", value: "TL-002", page: null, bbox: null },
                    { name: "TEN_LOAI_TAI_LIEU", display: "Tên loại tài liệu", type: "string", value: "Biên lai", page: null, bbox: null },
                    { name: "SO_CUA_TAI_LIEU", display: "Số của tài liệu", type: "string", value: "102", page: null, bbox: null },
                    { name: "NGAY_THANG_NAM_BAN_HANH", display: "Ngày tháng năm ban hành", type: "string", value: "2024-05-11", page: null, bbox: null },
                ],
            },
        ],
    };

    const buffer = await buildDynamicMetadataExcel([multiFileTt05Metadata]);
    assertEquals(buffer.byteLength > 0, true);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer as ArrayBuffer);
    const sheet = workbook.getWorksheet("Metadata");
    assertEquals(sheet != null, true);

    // Header row + 2 file rows
    assertEquals(sheet!.actualRowCount, 3);

    // Check Header Titles and Fill Colors
    const cellA1 = sheet!.getCell(1, 1);
    const cellH1 = sheet!.getCell(1, 8);
    const cellP1 = sheet!.getCell(1, 16);
    assertEquals(cellA1.value, "STT");
    assertEquals(sheet!.getCell(1, 2).value, "Mã định danh văn bản");
    assertEquals(sheet!.getCell(1, 3).value, "Mã hồ sơ");

    assertEquals((cellA1.fill as { fgColor?: { argb?: string } })?.fgColor?.argb, "FF8EAADB");
    assertEquals((cellH1.fill as { fgColor?: { argb?: string } })?.fgColor?.argb, "FFFFFF00");
    assertEquals((cellP1.fill as { fgColor?: { argb?: string } })?.fgColor?.argb, "FFA9CD90");

    // Row 2 (File 1)
    assertEquals(sheet!.getCell(2, 1).value, "1"); // STT
    assertEquals(sheet!.getCell(2, 2).value, "TL-001"); // Mã định danh file 1
    assertEquals(sheet!.getCell(2, 3).value, "HS-999_TEST"); // Mã hồ sơ dossier

    // Row 3 (File 2)
    assertEquals(sheet!.getCell(3, 1).value, "1"); // STT (merged)
    assertEquals(sheet!.getCell(3, 2).value, "TL-002"); // Mã định danh file 2
    assertEquals(sheet!.getCell(3, 3).value, "HS-999_TEST"); // Mã hồ sơ dossier (merged)

    // Check date parsing auto-fill columns (Day, Month, Year)
    const dayFile1 = sheet!.getCell(2, 19).value;
    const monthFile1 = sheet!.getCell(2, 20).value;
    const yearFile1 = sheet!.getCell(2, 21).value;
    assertEquals(dayFile1, "10");
    assertEquals(monthFile1, "5");
    assertEquals(yearFile1, "2024");

    const dayFile2 = sheet!.getCell(3, 19).value;
    const monthFile2 = sheet!.getCell(3, 20).value;
    const yearFile2 = sheet!.getCell(3, 21).value;
    assertEquals(dayFile2, "11");
    assertEquals(monthFile2, "5");
    assertEquals(yearFile2, "2024");

    // Check file path column (Col 32 / AF)
    assertEquals(sheet!.getCell(2, 32).value, "raw/doc_1.pdf");
    assertEquals(sheet!.getCell(3, 32).value, "raw/doc_2.pdf");
});

Deno.test("buildDynamicMetadataExcel exports PVEP sample metadata with file_name MA_DINH_DANH_VAN_BAN", async () => {
    const jsonText = await Deno.readTextFile("packages/sohoa-backend/assets/metadata_Pvep_sample.json");
    const pvepMetadata: DossierMetadata = JSON.parse(jsonText);

    const columns = buildDefaultExportConfig([pvepMetadata]);
    const buffer = await buildDynamicMetadataExcel([pvepMetadata], { exportConfig: { columns } });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer as ArrayBuffer);
    const sheet = workbook.getWorksheet("Metadata");
    assertEquals(sheet != null, true);

    // Header row + 5 document rows
    assertEquals(sheet!.actualRowCount, 6);

    // Check MA_DINH_DANH_VAN_BAN (Col B / 2) displays file_name
    assertEquals(sheet!.getCell(2, 2).value, "PVEP.2002.0964.001.pdf");
    assertEquals(sheet!.getCell(3, 2).value, "PVEP.2002.0964.002.pdf");
    assertEquals(sheet!.getCell(4, 2).value, "PVEP.2002.0964.003.pdf");
    assertEquals(sheet!.getCell(5, 2).value, "PVEP.2002.0964.004.pdf");
    assertEquals(sheet!.getCell(6, 2).value, "PVEP.2002.0964.BIA.pdf");

    // Check dossier-level metadata
    assertEquals(sheet!.getCell(2, 3).value, "0964"); // Mã hồ sơ
    assertEquals(sheet!.getCell(2, 5).value, "ALG"); // Mã phông

    // Check document-level metadata
    assertEquals(sheet!.getCell(2, 17).value, "1330"); // Số của văn bản
    assertEquals(sheet!.getCell(2, 19).value, "14"); // Ngày
    assertEquals(sheet!.getCell(2, 20).value, "1"); // Tháng
    assertEquals(sheet!.getCell(2, 21).value, "2002"); // Năm

    // Find column index for "Số lượng trang của văn bản" & "Tình trạng vật lý"
    const soLuongTrangColIdx = columns.findIndex((c) => c.header === "Số lượng trang của văn bản") + 1;
    const tinhTrangVatLyColIdx = columns.findIndex((c) => c.header === "Tình trạng vật lý") + 1;
    assertEquals(sheet!.getCell(2, soLuongTrangColIdx).value, "2");
    assertEquals(sheet!.getCell(2, tinhTrangVatLyColIdx).value, "Bình thường");
    assertEquals(
        sheet!.getCell(2, 32).value,
        "raw/1.DL PDF/LAN 1/CSDL_SOHOA_PVEP/ALG/VV/358/0964/PVEP.2002.0964.001.pdf",
    ); // Đường dẫn file

    // Check that standard TT05 columns count is exactly 32 and no extra fields are appended
    assertEquals(columns.length, 32);
    const headers = columns.map((c) => c.header);
    assertEquals(headers[headers.length - 1], "Đường dẫn file");
    assertEquals(headers.includes("Chú giải"), false);
    assertEquals(headers.includes("Ghi chú"), false);
});

