import { assertEquals } from "@std/assert";
import ExcelJS from "exceljs";
import {
    buildDefaultExportConfig,
    resolveExportColumnValue,
    resolveExportFieldValue,
} from "../libs/metadata-export-field-resolver.ts";
import { buildDynamicMetadataExcel } from "../libs/metadata-excel-export.ts";
import { collectFolderMetadataExportEntries, buildFolderMetadataExportZipStream, buildFolderMetadataExportZipStreamIncremental } from "../libs/metadata-export.ts";
import { buildMetadataExportPreview } from "../libs/metadata-export-preview.ts";
import type { DossierMetadata } from "../libs/metadata-types.ts";
import { readableStreamToUint8Array } from "../libs/jszip-stream.ts";
import {
    BlobReader,
    Uint8ArrayWriter,
    ZipReader,
} from "@zip.js/zip.js";

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

Deno.test("resolveExportFieldValue matches Vietnamese OCR names to canonical keys", () => {
    const metadata: DossierMetadata = {
        metadata_groups: [
            {
                group_code: "HO_SO_LUU_TRU",
                group_name: "Metadata cấp Hồ sơ lưu trữ",
                source_document: { file_name: null, file_path: null },
                fields: [
                    {
                        name: "Phông Số",
                        display: "Phông Số",
                        type: "string",
                        value: "028.25.04",
                        page: null,
                        bbox: null,
                    },
                    {
                        name: "Mục Lục Số",
                        display: "Mục Lục Số",
                        type: "string",
                        value: "01",
                        page: null,
                        bbox: null,
                    },
                ],
            },
        ],
    };

    assertEquals(
        resolveExportFieldValue(metadata, "HO_SO_LUU_TRU.MA_PHONG"),
        "028.25.04",
    );
    assertEquals(
        resolveExportFieldValue(metadata, "HO_SO_LUU_TRU.MUC_LUC_SO"),
        "01",
    );
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

Deno.test("buildDynamicMetadataExcel expands multi-file dossier into rows without merging dossier metadata", async () => {
    const ExcelJS = (await import("exceljs")).default;

    const multiFileTt05Metadata: DossierMetadata = {
        ho_so_id: "HS_MERGE_TEST",
        metadata_groups: [
            {
                group_code: "HO_SO_LUU_TRU",
                group_name: "Metadata cấp Hồ sơ lưu trữ",
                source_document: { file_name: "BIA.pdf", file_path: "raw/BIA.pdf" },
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

    // Header + BIA + 2 document rows
    assertEquals(sheet!.actualRowCount, 4);
    assertEquals(sheet!.hasMerges, false);

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

    // Row 2 (BIA) — hồ sơ metadata + path, no document id
    assertEquals(sheet!.getCell(2, 1).value, "1");
    assertEquals(sheet!.getCell(2, 2).value ?? "", "");
    assertEquals(sheet!.getCell(2, 3).value, "HS-999_TEST");
    assertEquals(sheet!.getCell(2, 32).value, "BIA.pdf");

    // Row 3 (File 1)
    assertEquals(sheet!.getCell(3, 1).value, "1");
    assertEquals(sheet!.getCell(3, 2).value, "TL-001");
    assertEquals(sheet!.getCell(3, 3).value, "HS-999_TEST");

    // Row 4 (File 2)
    assertEquals(sheet!.getCell(4, 1).value, "1");
    assertEquals(sheet!.getCell(4, 2).value, "TL-002");
    assertEquals(sheet!.getCell(4, 3).value, "HS-999_TEST");

    // Check date parsing auto-fill columns (Day, Month, Year) on document rows
    const dayFile1 = sheet!.getCell(3, 19).value;
    const monthFile1 = sheet!.getCell(3, 20).value;
    const yearFile1 = sheet!.getCell(3, 21).value;
    assertEquals(dayFile1, "10");
    assertEquals(monthFile1, "05");
    assertEquals(yearFile1, "2024");

    const dayFile2 = sheet!.getCell(4, 19).value;
    const monthFile2 = sheet!.getCell(4, 20).value;
    const yearFile2 = sheet!.getCell(4, 21).value;
    assertEquals(dayFile2, "11");
    assertEquals(monthFile2, "05");
    assertEquals(yearFile2, "2024");

    assertEquals(sheet!.getCell(3, 32).value, "doc_1.pdf");
    assertEquals(sheet!.getCell(4, 32).value, "doc_2.pdf");
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

    // Check MA_DINH_DANH_VAN_BAN (Col B / 2) displays file_name for documents;
    // BIA row only fills hồ sơ + path fields
    assertEquals(sheet!.getCell(2, 2).value, "PVEP.2002.0964.001.pdf");
    assertEquals(sheet!.getCell(3, 2).value, "PVEP.2002.0964.002.pdf");
    assertEquals(sheet!.getCell(4, 2).value, "PVEP.2002.0964.003.pdf");
    assertEquals(sheet!.getCell(5, 2).value, "PVEP.2002.0964.004.pdf");
    assertEquals(sheet!.getCell(6, 2).value ?? "", "");
    assertEquals(
        sheet!.getCell(6, 32).value,
        "1.DL PDF/LAN 1/CSDL_SOHOA_PVEP/ALG/VV/358/0964/PVEP.2002.0964.BIA.pdf",
    );

    // Check dossier-level metadata
    assertEquals(sheet!.getCell(2, 3).value, "0964"); // Mã hồ sơ
    assertEquals(sheet!.getCell(2, 5).value, "ALG"); // Mã phông

    // Check document-level metadata
    assertEquals(sheet!.getCell(2, 17).value, "1330"); // Số của văn bản
    assertEquals(sheet!.getCell(2, 19).value, "14"); // Ngày
    assertEquals(sheet!.getCell(2, 20).value, "01"); // Tháng
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
    ); // Đường dẫn file

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

    const dayVal = sheet!.getCell(3, 19).value;
    const monthVal = sheet!.getCell(3, 20).value;
    const yearVal = sheet!.getCell(3, 21).value;
    const fullDateVal = sheet!.getCell(3, 22).value;

    assertEquals(dayVal ?? "", "");
    assertEquals(monthVal ?? "", "");
    assertEquals(yearVal, "2024");
    assertEquals(fullDateVal, "05/08/2024");
});

Deno.test("buildDynamicMetadataExcel supports empty columns with no fieldKeys", async () => {
    const columns = [
        { header: "STT", fieldKeys: [], separator: "" },
        { header: "Ghi chú (Cột trống)", fieldKeys: [], separator: "" },
    ];
    const buffer = await buildDynamicMetadataExcel([sampleMetadata], { exportConfig: { columns } });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer as ArrayBuffer);
    const sheet = workbook.getWorksheet("Metadata");
    assertEquals(sheet != null, true);

    const emptyHeader = sheet!.getCell(1, 2).value;
    const emptyCellValue = sheet!.getCell(2, 2).value;

    assertEquals(emptyHeader, "Ghi chú (Cột trống)");
    assertEquals(emptyCellValue ?? "", "");
});

Deno.test("collectFolderMetadataExportEntries splits PDF and TIFF trees under shared folderPrefix", () => {
    const excelBuffer = new Uint8Array([1, 2, 3]);
    const pdfData = new Uint8Array([10, 11]);
    const tiffData = new Uint8Array([20, 21, 22]);

    const entries = collectFolderMetadataExportEntries({
        excelFileName: "export-metadata-export.xlsx",
        excelBuffer,
        dossierPdfBundles: [
            {
                dossierFolderName: "HoSo",
                baseFolderName: "PVEP",
                relativeFolderPath: "01/20",
                pdfFiles: [{ fileName: "1.PDF", data: pdfData }],
                tiffFiles: [{ fileName: "1.TIFF", data: tiffData }],
            },
        ],
    });

    assertEquals(entries.map((e) => e.name), [
        "export-metadata-export.xlsx",
        "PDF/PVEP/01/20/1.PDF",
        "TIFF/PVEP/01/20/1.TIFF",
    ]);
    assertEquals(entries[1]?.data, pdfData);
    assertEquals(entries[2]?.data, tiffData);
});

Deno.test("buildDynamicMetadataExcel includes BIA and orphan MUCLUC with kind-specific fields", async () => {
    const metadata: DossierMetadata = {
        ho_so_id: "HS_BIA_MUCLUC",
        metadata_groups: [
            {
                group_code: "HO_SO_LUU_TRU",
                group_name: "Metadata cấp Hồ sơ lưu trữ",
                source_document: {
                    file_name: "BIA.pdf",
                    file_path: "raw/CSDL/01/0001/BIA.pdf",
                },
                fields: [
                    {
                        name: "TIEU_DE_HO_SO",
                        display: "Tiêu đề hồ sơ",
                        type: "string",
                        value: "Hồ sơ quyết định",
                        page: null,
                        bbox: null,
                    },
                    {
                        name: "MA_HO_SO",
                        display: "Mã hồ sơ",
                        type: "string",
                        value: "0001",
                        page: null,
                        bbox: null,
                    },
                ],
            },
            {
                group_code: "TAI_LIEU_LUU_TRU",
                group_name: "Metadata cấp Tài liệu lưu trữ",
                source_document: {
                    file_name: "001.pdf",
                    file_path: "raw/CSDL/01/0001/001.pdf",
                },
                fields: [
                    {
                        name: "TRICH_YEU_NOI_DUNG",
                        display: "Trích yếu nội dung",
                        type: "string",
                        value: "Quyết định số 1",
                        page: null,
                        bbox: null,
                    },
                ],
            },
        ],
    };

    const columns = [
        { header: "STT_HANG", fieldKeys: ["__row_number"], separator: "" },
        { header: "Tiêu đề hồ sơ", fieldKeys: ["HO_SO_LUU_TRU.TIEU_DE_HO_SO"], separator: "" },
        { header: "Trích yếu", fieldKeys: ["TAI_LIEU_LUU_TRU.TRICH_YEU_NOI_DUNG"], separator: "" },
        { header: "Path", fieldKeys: ["__file_path"], separator: "" },
    ];

    const buffer = await buildDynamicMetadataExcel([metadata], {
        exportConfig: { columns },
        dossierFilesList: [[
            { fileName: "BIA.pdf", filePath: "raw/CSDL/01/0001/BIA.pdf" },
            { fileName: "MUCLUC.pdf", filePath: "raw/CSDL/01/0001/MUCLUC.pdf" },
            { fileName: "001.pdf", filePath: "raw/CSDL/01/0001/001.pdf" },
        ]],
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer as ArrayBuffer);
    const sheet = workbook.getWorksheet("Metadata");
    assertEquals(sheet!.actualRowCount, 4);
    assertEquals(sheet!.hasMerges, false);

    // BIA — no row number
    assertEquals(sheet!.getCell(2, 1).value ?? "", "");
    assertEquals(sheet!.getCell(2, 2).value, "Hồ sơ quyết định");
    assertEquals(sheet!.getCell(2, 3).value ?? "", "");
    assertEquals(sheet!.getCell(2, 4).value, "CSDL/01/0001/BIA.pdf");

    // MUCLUC — path only, no row number
    assertEquals(sheet!.getCell(3, 1).value ?? "", "");
    assertEquals(sheet!.getCell(3, 2).value ?? "", "");
    assertEquals(sheet!.getCell(3, 3).value ?? "", "");
    assertEquals(sheet!.getCell(3, 4).value, "CSDL/01/0001/MUCLUC.pdf");

    // Document — hồ sơ + tài liệu, first numbered document
    assertEquals(sheet!.getCell(4, 1).value, "1");
    assertEquals(sheet!.getCell(4, 2).value, "Hồ sơ quyết định");
    assertEquals(sheet!.getCell(4, 3).value, "Quyết định số 1");
    assertEquals(sheet!.getCell(4, 4).value, "CSDL/01/0001/001.pdf");
});

Deno.test("resolveExportColumnValue joins fields without surrounding separator spaces", () => {
    const value = resolveExportColumnValue(sampleMetadata, {
        header: "Joined",
        fieldKeys: ["DUONG_SU.SO_CCCD", "DUONG_SU.HO_VA_TEN"],
        separator: "/",
    });
    assertEquals(value, "001122334455/Nguyễn Văn A\nTrần Thị B");
});

Deno.test("__row_number increments across dossiers", async () => {
    const columns = [
        { header: "STT_HANG", fieldKeys: ["__row_number"], separator: "" },
        { header: "Mã", fieldKeys: ["__ho_so_id"], separator: "" },
    ];

    const buffer = await buildDynamicMetadataExcel(
        [
            {
                ho_so_id: "HS_A",
                metadata_groups: [
                    {
                        group_code: "TAI_LIEU_LUU_TRU",
                        group_name: "TL",
                        source_document: { file_name: "a1.pdf", file_path: "raw/a1.pdf" },
                        fields: [],
                    },
                    {
                        group_code: "TAI_LIEU_LUU_TRU",
                        group_name: "TL",
                        source_document: { file_name: "a2.pdf", file_path: "raw/a2.pdf" },
                        fields: [],
                    },
                ],
            },
            {
                ho_so_id: "HS_B",
                metadata_groups: [
                    {
                        group_code: "TAI_LIEU_LUU_TRU",
                        group_name: "TL",
                        source_document: { file_name: "b1.pdf", file_path: "raw/b1.pdf" },
                        fields: [],
                    },
                ],
            },
        ],
        { exportConfig: { columns } },
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer as ArrayBuffer);
    const sheet = workbook.getWorksheet("Metadata");
    assertEquals(sheet!.getCell(2, 1).value, "1");
    assertEquals(sheet!.getCell(3, 1).value, "2");
    assertEquals(sheet!.getCell(4, 1).value, "3");
});

Deno.test("__dossier_folder resolves from dossier folder path and joins with file name", async () => {
    const metadata: DossierMetadata = {
        ho_so_id: "0001",
        metadata_groups: [
            {
                group_code: "TAI_LIEU_LUU_TRU",
                group_name: "TL",
                source_document: {
                    file_name: "BIA.pdf",
                    file_path: "raw/CSDL/028.25.05/01/0001/BIA.pdf",
                },
                fields: [],
            },
        ],
    };

    const columns = [
        {
            header: "Folder",
            fieldKeys: ["__dossier_folder"],
            separator: "",
        },
        {
            header: "Joined",
            fieldKeys: ["__dossier_folder", "__file_name"],
            separator: "/",
        },
    ];

    const buffer = await buildDynamicMetadataExcel([metadata], {
        exportConfig: { columns },
        dossierFolderPaths: ["raw/CSDL/028.25.05/01/0001"],
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer as ArrayBuffer);
    const sheet = workbook.getWorksheet("Metadata");
    assertEquals(sheet!.getCell(2, 1).value, "0001");
    assertEquals(sheet!.getCell(2, 2).value, "0001/BIA.pdf");
});

Deno.test("document row does not fall back to sibling document fields", async () => {
    const metadata: DossierMetadata = {
        metadata_groups: [
            {
                group_code: "TAI_LIEU_LUU_TRU",
                group_name: "TL",
                source_document: { file_name: "doc_a.pdf", file_path: "raw/doc_a.pdf" },
                fields: [
                    {
                        name: "KY_HIEU_CUA_VAN_BAN",
                        display: "Ký hiệu",
                        type: "string",
                        value: "QĐ/ĐTN",
                        page: null,
                        bbox: null,
                    },
                ],
            },
            {
                group_code: "TAI_LIEU_LUU_TRU",
                group_name: "TL",
                source_document: { file_name: "doc_b.pdf", file_path: "raw/doc_b.pdf" },
                fields: [],
            },
        ],
    };

    const columns = [
        {
            header: "Ký hiệu",
            fieldKeys: ["TAI_LIEU_LUU_TRU.KY_HIEU_CUA_VAN_BAN"],
            separator: "",
        },
    ];

    const buffer = await buildDynamicMetadataExcel([metadata], {
        exportConfig: { columns },
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer as ArrayBuffer);
    const sheet = workbook.getWorksheet("Metadata");
    assertEquals(sheet!.getCell(2, 1).value, "QĐ/ĐTN");
    assertEquals(sheet!.getCell(3, 1).value ?? "", "");
});

Deno.test("buildDynamicMetadataExcel with tuyen_quang.json excludes BIA and CHUNG TU KET THUC from STT, Ma dinh danh and total document count", async () => {
    let jsonText = "";
    for (const path of [
        "packages/sohoa-backend/assets/tuyen_quang.json",
        "assets/tuyen_quang.json",
    ]) {
        try {
            jsonText = await Deno.readTextFile(path);
            break;
        } catch {
            // try next
        }
    }
    const metadata: DossierMetadata = JSON.parse(jsonText);

    const columns = [
        {
            header: "Mã định danh tài liệu",
            fieldKeys: ["HO_SO_LUU_TRU.MA_PHONG", "HO_SO_LUU_TRU.MUC_LUC_SO", "__row_number"],
            separator: ".",
        },
        {
            header: "Số thứ tự văn bản trong hồ sơ",
            fieldKeys: ["__row_number"],
            separator: "",
        },
        {
            header: "Tên loại tài liệu",
            fieldKeys: ["TAI_LIEU_LUU_TRU.TEN_LOAI_VAN_BAN"],
            separator: "",
        },
        {
            header: "Tổng số tài liệu trong hồ sơ",
            fieldKeys: ["HO_SO_LUU_TRU.SO_TAI_LIEU"],
            separator: "",
        },
        {
            header: "Path",
            fieldKeys: ["__file_path"],
            separator: "",
        },
    ];

    const buffer = await buildDynamicMetadataExcel([metadata], {
        exportConfig: { columns },
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer as ArrayBuffer);
    const sheet = workbook.getWorksheet("Metadata");

    // 5 rows: BIA, 0042_2 (QUYET DINH), 0042_3 (BAO CAO), 0042_4 (CHUNG TU KET THUC), MUCLUC
    // Row 2: BIA
    assertEquals(sheet!.getCell(2, 1).value ?? "", ""); // Ma dinh danh is empty (no partial 028.25.05.01)
    assertEquals(sheet!.getCell(2, 2).value ?? "", ""); // STT is empty
    assertEquals(sheet!.getCell(2, 3).value ?? "", ""); // Ten loai van ban is empty
    assertEquals(sheet!.getCell(2, 4).value, "2"); // 3 - 1 closing doc = 2!
    assertEquals(sheet!.getCell(2, 5).value, "CSDL_SOHOA_TUTQ/028.25.05/01/0001/BIA.pdf");

    // Row 3: 0042_2 (QUYẾT ĐINH)
    assertEquals(sheet!.getCell(3, 1).value, "028.25.05.01.1");
    assertEquals(sheet!.getCell(3, 2).value, "1");
    assertEquals(sheet!.getCell(3, 3).value, "QUYẾT ĐINH");
    assertEquals(sheet!.getCell(3, 4).value, "2");
    assertEquals(sheet!.getCell(3, 5).value, "CSDL_SOHOA_TUTQ/028.25.05/01/0001/0042_2.pdf");

    // Row 4: 0042_3 (BÁO CÁO)
    assertEquals(sheet!.getCell(4, 1).value, "028.25.05.01.2");
    assertEquals(sheet!.getCell(4, 2).value, "2");
    assertEquals(sheet!.getCell(4, 3).value, "BÁO CÁO");
    assertEquals(sheet!.getCell(4, 4).value, "2");
    assertEquals(sheet!.getCell(4, 5).value, "CSDL_SOHOA_TUTQ/028.25.05/01/0001/0042_3.pdf");

    // Row 5: 0042_4 (CHỨNG TỪ KẾT THÚC)
    assertEquals(sheet!.getCell(5, 1).value ?? "", ""); // Ma dinh danh is empty
    assertEquals(sheet!.getCell(5, 2).value ?? "", ""); // STT is empty
    assertEquals(sheet!.getCell(5, 3).value, "CHỨNG TỪ KẾT THÚC");
    assertEquals(sheet!.getCell(5, 4).value, "2");
    assertEquals(sheet!.getCell(5, 5).value, "CSDL_SOHOA_TUTQ/028.25.05/01/0001/0042_4.pdf");

    // Row 6: MUCLUC
    assertEquals(sheet!.getCell(6, 1).value ?? "", ""); // Ma dinh danh is empty
    assertEquals(sheet!.getCell(6, 2).value ?? "", ""); // STT is empty
    assertEquals(sheet!.getCell(6, 3).value ?? "", "");
    assertEquals(sheet!.getCell(6, 4).value, "2");
    assertEquals(sheet!.getCell(6, 5).value, "CSDL_SOHOA_TUTQ/028.25.05/01/0001/MUCLUC.pdf");
});

Deno.test("buildMetadataExportPreview matches Excel row values for CHUNG TU KET THUC and BIA", () => {
    const metadata: DossierMetadata = {
        ho_so_id: "HS_01",
        metadata_groups: [
            {
                group_code: "HO_SO_LUU_TRU",
                group_name: "Ho so",
                source_document: { file_name: "BIA.pdf", file_path: "raw/BIA.pdf" },
                fields: [
                    { name: "MA_PHONG", display: "Phông", type: "string", value: "P01", page: null, bbox: null, bboxes: [] },
                    { name: "TONG_SO_TAI_LIEU_TRONG_HO_SO", display: "Tổng số", type: "string", value: "3", page: null, bbox: null, bboxes: [] },
                ],
            },
            {
                group_code: "TAI_LIEU_LUU_TRU",
                group_name: "Tai lieu",
                source_document: { file_name: "doc1.pdf", file_path: "raw/doc1.pdf" },
                fields: [
                    { name: "TEN_LOAI_VAN_BAN", display: "Loại", type: "string", value: "CHỨNG TỪ KẾT THÚC", page: null, bbox: null, bboxes: [] },
                ],
            },
            {
                group_code: "TAI_LIEU_LUU_TRU",
                group_name: "Tai lieu",
                source_document: { file_name: "doc2.pdf", file_path: "raw/doc2.pdf" },
                fields: [
                    { name: "TEN_LOAI_VAN_BAN", display: "Loại", type: "string", value: "BÁO CÁO", page: null, bbox: null, bboxes: [] },
                ],
            },
        ],
    };

    const columns = [
        { header: "Mã định danh tài liệu", fieldKeys: ["HO_SO_LUU_TRU.MA_PHONG", "__row_number"], separator: "." },
        { header: "STT", fieldKeys: ["__row_number"], separator: "" },
        { header: "Loại", fieldKeys: ["TAI_LIEU_LUU_TRU.TEN_LOAI_VAN_BAN"], separator: "" },
        { header: "Tổng số", fieldKeys: ["HO_SO_LUU_TRU.TONG_SO_TAI_LIEU_TRONG_HO_SO"], separator: "" },
    ];

    const preview = buildMetadataExportPreview([metadata], { columns });
    assertEquals(preview.rows.length, 3);

    // BIA
    assertEquals(preview.rows[0]?.cells[0], "");
    assertEquals(preview.rows[0]?.cells[1], "");
    assertEquals(preview.rows[0]?.cells[2], "");
    assertEquals(preview.rows[0]?.cells[3], "2"); // 3 - 1 = 2

    // CHỨNG TỪ KẾT THÚC
    assertEquals(preview.rows[1]?.cells[0], "");
    assertEquals(preview.rows[1]?.cells[1], "");
    assertEquals(preview.rows[1]?.cells[2], "CHỨNG TỪ KẾT THÚC");
    assertEquals(preview.rows[1]?.cells[3], "2");

    // BÁO CÁO
    assertEquals(preview.rows[2]?.cells[0], "P01.1");
    assertEquals(preview.rows[2]?.cells[1], "1");
    assertEquals(preview.rows[2]?.cells[2], "BÁO CÁO");
    assertEquals(preview.rows[2]?.cells[3], "2");
});

Deno.test("collectFolderMetadataExportEntries excel-only has no PDF or TIFF entries", () => {
    const excelBuffer = new Uint8Array([1, 2, 3]);
    const entries = collectFolderMetadataExportEntries({
        excelFileName: "export-metadata.xlsx",
        excelBuffer,
        dossierPdfBundles: [],
    });
    assertEquals(entries.map((e) => e.name), ["export-metadata.xlsx"]);
    assertEquals(
        entries.some((e) => e.name.startsWith("PDF/") || e.name.startsWith("TIFF/")),
        false,
    );
});

Deno.test(
    "buildFolderMetadataExportZipStreamIncremental excel-only build yields only xlsx",
    { sanitizeOps: false, sanitizeResources: false },
    async () => {
    const stream = buildFolderMetadataExportZipStreamIncremental({
        excelFileName: "meta-only.xlsx",
        excelBuffer: new Uint8Array([9, 8, 7]),
        // Mirrors buildApprovedMetadataExportZip when excelOnly === true
        build: async () => {},
    });
    const bytes = await readableStreamToUint8Array(stream);
    const zr = new ZipReader(new BlobReader(new Blob([new Uint8Array(bytes)])));
    try {
        const entries = await zr.getEntries();
        const names = entries.filter((e) => !e.directory).map((e) => e.filename);
        assertEquals(names, ["meta-only.xlsx"]);
        assertEquals(
            names.some((n) => n.startsWith("PDF/") || n.startsWith("TIFF/")),
            false,
        );
    } finally {
        await zr.close();
    }
});

Deno.test(
    "buildFolderMetadataExportZipStream includes PDF and TIFF trees",
    { sanitizeOps: false, sanitizeResources: false },
    async () => {
    const pdfData = new TextEncoder().encode("%PDF-1.4 mock");
    const tiffData = new Uint8Array([0x49, 0x49, 0x2a, 0x00]);
    const stream = await buildFolderMetadataExportZipStream({
        excelFileName: "meta.xlsx",
        excelBuffer: new Uint8Array([1, 2, 3]),
        dossierPdfBundles: [
            {
                dossierFolderName: "HS1",
                pdfFiles: [{ fileName: "doc.pdf", data: pdfData }],
                tiffFiles: [{ fileName: "doc.TIFF", data: tiffData }],
            },
        ],
    });
    const bytes = await readableStreamToUint8Array(stream);
    const zr = new ZipReader(new BlobReader(new Blob([new Uint8Array(bytes)])));
    try {
        const entries = await zr.getEntries();
        const names = entries.filter((e) => !e.directory).map((e) => e.filename).sort();
        assertEquals(names, [
            "PDF/HS1/doc.pdf",
            "TIFF/HS1/doc.TIFF",
            "meta.xlsx",
        ]);
        const pdfEntry = entries.find((e) => e.filename === "PDF/HS1/doc.pdf");
        const pdfBytes = await pdfEntry!.getData!(new Uint8ArrayWriter());
        assertEquals(new TextDecoder().decode(pdfBytes), "%PDF-1.4 mock");
    } finally {
        await zr.close();
    }
});
