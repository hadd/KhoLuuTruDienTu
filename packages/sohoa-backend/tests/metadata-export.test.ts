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
    assertEquals(sheet!.getCell(2, 32).value, "doc_1.pdf");
    assertEquals(sheet!.getCell(3, 32).value, "doc_2.pdf");
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
    assertEquals(sheet!.getCell(2, 22).value, "14/01/2002"); // Ngày, tháng, năm văn bản (formatted dd/mm/yyyy)

    // Find column index for "Số lượng trang của văn bản" & "Tình trạng vật lý"
    const soLuongTrangColIdx = columns.findIndex((c) => c.header === "Số lượng trang của văn bản") + 1;
    const tinhTrangVatLyColIdx = columns.findIndex((c) => c.header === "Tình trạng vật lý") + 1;
    assertEquals(sheet!.getCell(2, soLuongTrangColIdx).value, "2");
    assertEquals(sheet!.getCell(2, tinhTrangVatLyColIdx).value, "Bình thường");
    assertEquals(
        sheet!.getCell(2, 32).value,
        "1.DL PDF/LAN 1/CSDL_SOHOA_PVEP/ALG/VV/358/0964/PVEP.2002.0964.001.pdf",
    ); // Đường dẫn file (stripped raw/)

    // Check that standard TT05 columns count is exactly 32 and no extra fields are appended
    assertEquals(columns.length, 32);
    const headers = columns.map((c) => c.header);
    assertEquals(headers[headers.length - 1], "Đường dẫn file");
    assertEquals(headers.includes("Chú giải"), false);
    assertEquals(headers.includes("Ghi chú"), false);
});

Deno.test("buildDynamicMetadataExcel formats dates to dd/mm/yyyy and omits 0 values for day, month, year", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const zeroDateMetadata: DossierMetadata = {
        ho_so_id: "HS_ZERO_DATE",
        metadata_groups: [
            {
                group_code: "HO_SO_LUU_TRU",
                group_name: "Metadata cấp Hồ sơ lưu trữ",
                source_document: { file_name: "bia.pdf", file_path: "raw/bia.pdf" },
                fields: [
                    { name: "MA_HO_SO", display: "Mã hồ sơ", type: "string", value: "HS-001", page: null, bbox: null },
                ],
            },
            {
                group_code: "TAI_LIEU_LUU_TRU",
                group_name: "Metadata cấp Tài liệu lưu trữ",
                source_document: { file_name: "doc_zero.pdf", file_path: "raw/doc_zero.pdf" },
                fields: [
                    { name: "MA_DINH_DANH_TAI_LIEU", display: "Mã định danh", type: "string", value: "TL-ZERO", page: null, bbox: null },
                    { name: "NGAY", display: "Ngày", type: "string", value: "0", page: null, bbox: null },
                    { name: "THANG", display: "Tháng", type: "string", value: "0", page: null, bbox: null },
                    { name: "NAM", display: "Năm", type: "string", value: "2024", page: null, bbox: null },
                    { name: "NGAY_THANG_NAM_BAN_HANH", display: "Ngày tháng năm ban hành", type: "string", value: "2024-08-05", page: null, bbox: null },
                ],
            },
        ],
    };

    const columns = buildDefaultExportConfig([zeroDateMetadata]);
    const buffer = await buildDynamicMetadataExcel([zeroDateMetadata], { exportConfig: { columns } });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer as ArrayBuffer);
    const sheet = workbook.getWorksheet("Metadata");
    assertEquals(sheet != null, true);

    const dayVal = sheet!.getCell(2, 19).value;
    const monthVal = sheet!.getCell(2, 20).value;
    const yearVal = sheet!.getCell(2, 21).value;
    const fullDateVal = sheet!.getCell(2, 22).value;

    assertEquals(dayVal ?? "", "");
    assertEquals(monthVal ?? "", "");
    assertEquals(yearVal, "2024");
    assertEquals(fullDateVal, "05/08/2024");
});

Deno.test("buildDynamicMetadataExcel sets Times New Roman size 14 and numFmt dd/mm/yyyy", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const buffer = await buildDynamicMetadataExcel([sampleMetadata]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer as ArrayBuffer);
    const sheet = workbook.getWorksheet("Metadata")!;

    // Verify header cell font
    const headerCell = sheet.getCell(1, 1);
    assertEquals(headerCell.font?.name, "Times New Roman");
    assertEquals(headerCell.font?.size, 14);
    assertEquals(headerCell.font?.bold, true);

    // Verify data cell font
    const dataCell = sheet.getCell(2, 1);
    assertEquals(dataCell.font?.name, "Times New Roman");
    assertEquals(dataCell.font?.size, 14);

    // Test with date column
    const dateMetadata: DossierMetadata = {
        metadata_groups: [
            {
                group_code: "HO_SO_LUU_TRU",
                group_name: "Hồ sơ",
                source_document: { file_name: null, file_path: null },
                fields: [
                    { name: "NGAY_TAO", display: "Ngày tạo", type: "date", value: "14/09/2026", page: null, bbox: null },
                ],
            },
        ],
    };
    const dateBuffer = await buildDynamicMetadataExcel([dateMetadata], {
        exportConfig: {
            columns: [
                { header: "STT", fieldKeys: [], separator: "" },
                { header: "Ngày tạo", fieldKeys: ["HO_SO_LUU_TRU.NGAY_TAO"], separator: "" },
            ],
        },
    });
    const dateWb = new ExcelJS.Workbook();
    await dateWb.xlsx.load(dateBuffer.buffer as ArrayBuffer);
    const dateSheet = dateWb.getWorksheet("Metadata")!;

    // Find date column index: Column 2 is Ngày tạo
    const dateDataCell = dateSheet.getCell(2, 2);
    assertEquals(dateDataCell.font?.name, "Times New Roman");
    assertEquals(dateDataCell.font?.size, 14);
    assertEquals(dateDataCell.numFmt, "dd/mm/yyyy");
});

Deno.test("generateHsCode produces zero-padded HS codes", async () => {
    const { generateHsCode } = await import("../libs/metadata-export.ts");
    assertEquals(generateHsCode(0), "HS_01");
    assertEquals(generateHsCode(1), "HS_02");
    assertEquals(generateHsCode(8), "HS_09");
    assertEquals(generateHsCode(9), "HS_10");
    assertEquals(generateHsCode(99), "HS_100");
});

Deno.test("collectFolderMetadataExportEntries formats folders as HS_01, HS_02 with pdfs/", async () => {
    const { collectFolderMetadataExportEntries } = await import("../libs/metadata-export.ts");
    const entries = collectFolderMetadataExportEntries({
        excelFileName: "metadata.xlsx",
        excelBuffer: new Uint8Array([1, 2, 3]),
        dossierPdfBundles: [
            {
                dossierFolderName: "Dossier_Alpha",
                pdfFiles: [
                    { fileName: "doc1.pdf", data: new Uint8Array([10]) },
                    { fileName: "doc2.pdf", data: new Uint8Array([20]) },
                ],
            },
            {
                dossierFolderName: "Dossier_Beta",
                pdfFiles: [
                    { fileName: "report.pdf", data: new Uint8Array([30]) },
                ],
            },
            {
                dossierFolderName: "Dossier_Gamma",
                pdfFiles: [
                    { fileName: "contract.pdf", data: new Uint8Array([40]) },
                ],
            },
        ],
    });

    assertEquals(entries.length, 5);
    assertEquals(entries[0]!.name, "metadata.xlsx");
    assertEquals(entries[1]!.name, "HS_01/pdfs/doc1.pdf");
    assertEquals(entries[2]!.name, "HS_01/pdfs/doc2.pdf");
    assertEquals(entries[3]!.name, "HS_02/pdfs/report.pdf");
    assertEquals(entries[4]!.name, "HS_03/pdfs/contract.pdf");
});



