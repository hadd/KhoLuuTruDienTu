import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { storageDirname } from "../modules/dossier/dossier-path-utils.ts";
import type { DossierMetadata, MetadataField } from "./metadata-types.ts";
import {
    BAO_CAO_RECEIVABLE_SECTIONS,
    METADATA_EXPORT_CHU_DONG_ROWS,
    METADATA_EXPORT_FIXED_COLUMNS,
    METADATA_EXPORT_LAST_COL,
    METADATA_EXPORT_MAIN_ROW,
    METADATA_EXPORT_REMOVED_COLUMN_SPLICES,
    parseBaoCaoReceivableField,
    resolveBaoCaoFieldColumn,
    resolveGroupFieldColumn,
    stripRecordIndex,
} from "./metadata-export-column-map.ts";

const TEMPLATE_PATH = join(
    dirname(fileURLToPath(import.meta.url)),
    "../assets/Export_Metadata_Template.xlsx",
);

export function extractRecordIndex(fieldName: string): number | null {
    return stripRecordIndex(fieldName).index;
}

function formatCellValue(value: string | null | undefined): string {
    if (value === null || value === undefined) {
        return "";
    }
    return String(value);
}

function findPrimarySourceDirectory(metadata: DossierMetadata): string {
    for (const group of metadata.metadata_groups) {
        const filePath = group.source_document?.file_path;
        if (filePath) {
            return storageDirname(filePath);
        }
    }
    return "";
}

function setCell(sheet: ExcelJS.Worksheet, row: number, col: number, value: string) {
    if (!value) {
        return;
    }
    const cell = sheet.getCell(row, col);
    cell.value = value;
    cell.alignment = { wrapText: true, vertical: "top" };
}

export interface BuildMetadataExcelOptions {
    /** Số thứ tự hồ sơ khi xuất nhiều hồ sơ cùng lúc; mặc định 1. */
    stt?: number;
    /** Dòng ghi dữ liệu (mặc định METADATA_EXPORT_MAIN_ROW). */
    targetRow?: number;
    /**
     * Gộp mọi nhóm báo cáo đối chiếu vào một dòng (dùng khi xuất bộ hồ sơ: mỗi metadata một dòng).
     */
    singleRowPerDossier?: boolean;
}

function collectGroupNames(metadata: DossierMetadata): string {
    const names: string[] = [];
    for (const group of metadata.metadata_groups) {
        if (group.group_name != null && String(group.group_name).trim() !== "") {
            names.push(String(group.group_name).trim());
        }
    }
    return names.join(", ");
}

function findFieldValue(metadata: DossierMetadata, fieldName: string): string {
    for (const group of metadata.metadata_groups) {
        for (const field of group.fields) {
            if (field.name === fieldName) {
                return formatCellValue(field.value);
            }
        }
    }
    return "";
}

function resolveReceivableRow(
    section: string,
    recordIndex: number,
    options: BuildMetadataExcelOptions = {},
): number {
    const targetRow = options.targetRow ?? METADATA_EXPORT_MAIN_ROW;

    if (options.singleRowPerDossier) {
        return targetRow;
    }

    const config = BAO_CAO_RECEIVABLE_SECTIONS[section];
    if (!config) {
        return targetRow;
    }

    if (section === "SO_PHAI_THU_CHU_DONG") {
        if (recordIndex >= 1 && recordIndex <= METADATA_EXPORT_CHU_DONG_ROWS.length) {
            return METADATA_EXPORT_CHU_DONG_ROWS[recordIndex - 1];
        }
        return targetRow;
    }

    return config.rows[recordIndex - 1] ?? config.rows[0] ?? targetRow;
}

interface BaoCaoRecordAccumulator {
    section: string;
    recordIndex: number;
    values: Map<number, string>;
}

function prepareMetadataExportSheet(sheet: ExcelJS.Worksheet) {
    for (const splice of METADATA_EXPORT_REMOVED_COLUMN_SPLICES) {
        sheet.spliceColumns(splice.startCol, splice.count);
    }
}

function applyWrapTextToDataRows(sheet: ExcelJS.Worksheet, rows: readonly number[]) {
    const lastCol = sheet.columnCount || METADATA_EXPORT_LAST_COL;
    for (const row of rows) {
        for (let col = 1; col <= lastCol; col++) {
            const cell = sheet.getCell(row, col);
            if (cell.value === null || cell.value === undefined || cell.value === "") {
                continue;
            }
            cell.alignment = { wrapText: true, vertical: "top" };
        }
    }
}

function populateMetadataExportSheet(
    sheet: ExcelJS.Worksheet,
    metadata: DossierMetadata,
    options: BuildMetadataExcelOptions = {},
): number {
    const sourceDirectory = findPrimarySourceDirectory(metadata);
    const mainRow = options.targetRow ?? METADATA_EXPORT_MAIN_ROW;
    const groupNames = collectGroupNames(metadata);
    const stt = options.stt ?? 1;

    setCell(sheet, mainRow, METADATA_EXPORT_FIXED_COLUMNS.STT, String(stt));
    setCell(sheet, mainRow, METADATA_EXPORT_FIXED_COLUMNS.LOAI_TAI_LIEU, groupNames);
    setCell(sheet, mainRow, METADATA_EXPORT_FIXED_COLUMNS.PATH, sourceDirectory);

    const tieuChiCol = resolveBaoCaoFieldColumn("SO_PHAI_THU_CHU_DONG", "TIEU_CHI");
    if (tieuChiCol) {
        const tieuChi = findFieldValue(metadata, "SO_PHAI_THU_CHU_DONG_1_TIEU_CHI");
        setCell(sheet, mainRow, tieuChiCol, tieuChi);
    }

    const baoCaoRecords = new Map<string, BaoCaoRecordAccumulator>();

    for (const group of metadata.metadata_groups) {
        for (const field of group.fields) {
            applyMetadataField(sheet, group.group_code, field, baoCaoRecords, options);
        }
    }

    for (const record of baoCaoRecords.values()) {
        const row = resolveReceivableRow(record.section, record.recordIndex, options);
        for (const [col, value] of record.values) {
            if (
                record.section === "SO_PHAI_THU_CHU_DONG" &&
                col === tieuChiCol &&
                record.recordIndex === 1
            ) {
                continue;
            }
            setCell(sheet, row, col, value);
        }
    }

    if (options.singleRowPerDossier) {
        applyWrapTextToDataRows(sheet, [mainRow]);
    } else {
        applyWrapTextToDataRows(sheet, METADATA_EXPORT_CHU_DONG_ROWS);
    }

    return mainRow;
}

function applyMetadataField(
    sheet: ExcelJS.Worksheet,
    groupCode: string,
    field: MetadataField,
    baoCaoRecords: Map<string, BaoCaoRecordAccumulator>,
    options: BuildMetadataExcelOptions = {},
) {
    const cellValue = formatCellValue(field.value);
    if (!cellValue) {
        return;
    }

    if (groupCode === "BAO_CAO_DOI_CHIEU") {
        const parsed = parseBaoCaoReceivableField(field.name);
        if (!parsed) {
            return;
        }

        const col = resolveBaoCaoFieldColumn(parsed.section, parsed.suffix);
        if (!col) {
            return;
        }

        const key = `${parsed.section}:${parsed.recordIndex}`;
        let record = baoCaoRecords.get(key);
        if (!record) {
            record = {
                section: parsed.section,
                recordIndex: parsed.recordIndex,
                values: new Map(),
            };
            baoCaoRecords.set(key, record);
        }

        if (parsed.suffix !== "TIEU_CHI") {
            record.values.set(col, cellValue);
        }
        return;
    }

    const col = resolveGroupFieldColumn(groupCode, field.name);
    if (col) {
        const mainRow = options.targetRow ?? METADATA_EXPORT_MAIN_ROW;
        setCell(sheet, mainRow, col, cellValue);
    }
}

export async function buildMultiDossierMetadataExcel(
    metadataList: DossierMetadata[],
): Promise<Uint8Array> {
    if (metadataList.length === 0) {
        throw new Error("Cannot build folder metadata Excel: no dossiers");
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(TEMPLATE_PATH);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
        throw new Error("Export metadata template has no worksheet");
    }
    prepareMetadataExportSheet(sheet);

    let nextRow = METADATA_EXPORT_MAIN_ROW;
    for (let index = 0; index < metadataList.length; index++) {
        populateMetadataExportSheet(sheet, metadataList[index], {
            stt: index + 1,
            targetRow: nextRow,
            singleRowPerDossier: true,
        });
        nextRow += 1;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer as ArrayBuffer);
}

export async function buildMetadataExcel(
    metadata: DossierMetadata,
    options: BuildMetadataExcelOptions = {},
): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(TEMPLATE_PATH);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
        throw new Error("Export metadata template has no worksheet");
    }
    prepareMetadataExportSheet(sheet);

    populateMetadataExportSheet(sheet, metadata, options);

    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer as ArrayBuffer);
}
