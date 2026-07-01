import ExcelJS from "exceljs";
import type { DossierMetadata } from "./metadata-types.ts";
import {
    buildDefaultExportConfig,
    resolveExportColumnValue,
} from "./metadata-export-field-resolver.ts";
import { isExportSttColumn } from "./metadata-export-types.ts";
import type { MetadataExportColumnConfig, MetadataExportConfig } from "./metadata-export-types.ts";

const HEADER_ROW = 1;
const FIRST_DATA_ROW = 2;

function setCell(sheet: ExcelJS.Worksheet, row: number, col: number, value: string) {
    const cell = sheet.getCell(row, col);
    cell.value = value;
    if (value.includes("\n")) {
        cell.alignment = { wrapText: true, vertical: "top" };
    }
}

function writeHeaders(sheet: ExcelJS.Worksheet, columns: MetadataExportColumnConfig[]) {
    columns.forEach((column, index) => {
        const cell = sheet.getCell(HEADER_ROW, index + 1);
        cell.value = column.header;
        cell.font = { bold: true };
        cell.alignment = { vertical: "middle", wrapText: true };
    });
}

function writeDataRow(
    sheet: ExcelJS.Worksheet,
    row: number,
    metadata: DossierMetadata,
    columns: MetadataExportColumnConfig[],
    rowNumber: number,
) {
    columns.forEach((column, index) => {
        const value = resolveExportColumnValue(metadata, column, { rowNumber });
        if (value) {
            setCell(sheet, row, index + 1, value);
        }
    });
}

export interface BuildDynamicMetadataExcelOptions {
    exportConfig?: MetadataExportConfig;
}

export async function buildDynamicMetadataExcel(
    metadataList: DossierMetadata[],
    options: BuildDynamicMetadataExcelOptions = {},
): Promise<Uint8Array> {
    if (metadataList.length === 0) {
        throw new Error("Cannot build metadata Excel: no dossiers");
    }

    const columns = options.exportConfig?.columns
        ?? buildDefaultExportConfig(metadataList);

    if (columns.length === 0) {
        throw new Error("Cannot build metadata Excel: no export columns");
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Metadata");
    writeHeaders(sheet, columns);

    metadataList.forEach((metadata, index) => {
        writeDataRow(sheet, FIRST_DATA_ROW + index, metadata, columns, index + 1);
    });

    columns.forEach((column, index) => {
        const sheetColumn = sheet.getColumn(index + 1);
        sheetColumn.width = isExportSttColumn(column) ? 8 : 24;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer as ArrayBuffer);
}

/** @deprecated Use buildDynamicMetadataExcel */
export async function buildMetadataExcel(
    metadata: DossierMetadata,
    _options: { stt?: number; targetRow?: number; singleRowPerDossier?: boolean } = {},
): Promise<Uint8Array> {
    return await buildDynamicMetadataExcel([metadata]);
}

/** @deprecated Use buildDynamicMetadataExcel */
export async function buildMultiDossierMetadataExcel(
    metadataList: DossierMetadata[],
): Promise<Uint8Array> {
    return await buildDynamicMetadataExcel(metadataList);
}

export function extractRecordIndex(_fieldName: string): number | null {
    return null;
}
