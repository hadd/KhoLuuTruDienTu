import ExcelJS from "exceljs";
import type { DossierMetadata } from "./metadata-types.ts";
import {
    buildDefaultExportConfig,
    extractDossierFileItems,
    isDossierColumn,
    resolveExportColumnValueForFile,
    type ExportDossierFileInput,
} from "./metadata-export-field-resolver.ts";
import { isExportSttColumn } from "./metadata-export-types.ts";
import type { MetadataExportColumnConfig, MetadataExportConfig } from "./metadata-export-types.ts";

const HEADER_ROW = 1;
const FIRST_DATA_ROW = 2;

function writeHeaders(sheet: ExcelJS.Worksheet, columns: MetadataExportColumnConfig[]) {
    columns.forEach((column, index) => {
        const cell = sheet.getCell(HEADER_ROW, index + 1);
        cell.value = column.header;
        cell.font = { bold: true, name: "Times New Roman", size: 11 };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

        let fgColor = column.headerColor;
        if (!fgColor) {
            const colNum = index + 1;
            if (colNum >= 1 && colNum <= 7) {
                fgColor = "8EAADB";
            } else if (colNum >= 8 && colNum <= 15) {
                fgColor = "FFFF00";
            } else {
                fgColor = "A9CD90";
            }
        }

        const argb = fgColor.length === 6 ? `FF${fgColor.toUpperCase()}` : fgColor.toUpperCase();

        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb },
        };
        cell.border = {
            top: { style: "thin", color: { argb: "BFBFBF" } },
            left: { style: "thin", color: { argb: "BFBFBF" } },
            bottom: { style: "thin", color: { argb: "BFBFBF" } },
            right: { style: "thin", color: { argb: "BFBFBF" } },
        };
    });
}

function applyDataCellStyle(cell: ExcelJS.Cell, options: { isDossierCol: boolean }) {
    cell.font = { name: "Times New Roman", size: 11 };
    cell.border = {
        top: { style: "thin", color: { argb: "D9D9D9" } },
        left: { style: "thin", color: { argb: "D9D9D9" } },
        bottom: { style: "thin", color: { argb: "D9D9D9" } },
        right: { style: "thin", color: { argb: "D9D9D9" } },
    };
    cell.alignment = {
        wrapText: true,
        vertical: "middle",
        horizontal: options.isDossierCol ? "center" : "left",
    };
}

export interface BuildDynamicMetadataExcelOptions {
    exportConfig?: MetadataExportConfig;
    /** Parallel to metadataList — dossier PDF files for orphan MUCLUC rows. */
    dossierFilesList?: Array<ExportDossierFileInput[] | undefined>;
    /** Parallel to metadataList — dossier folder path (thư mục chứa hồ sơ). */
    dossierFolderPaths?: Array<string | null | undefined>;
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

    let currentRow = FIRST_DATA_ROW;
    let documentRowNumber = 0;

    metadataList.forEach((metadata, dossierIndex) => {
        const dossierFiles = options.dossierFilesList?.[dossierIndex] ?? [];
        const dossierFolderPath = options.dossierFolderPaths?.[dossierIndex] ?? null;
        const fileItems = extractDossierFileItems(metadata, dossierFiles);
        const fileCount = fileItems.length;
        const dossierRowCount = Math.max(1, fileCount);

        for (let k = 0; k < dossierRowCount; k++) {
            const r = currentRow + k;
            const fileItem = fileItems[k]!;
            const kind = fileItem.kind ?? "document";
            const rowNumber = kind === "bia" || kind === "mucluc"
                ? undefined
                : ++documentRowNumber;

            columns.forEach((column, colIdx) => {
                const colNum = colIdx + 1;
                const isDossierCol = isDossierColumn(column);
                const value = resolveExportColumnValueForFile(
                    metadata,
                    fileItem,
                    column,
                    {
                        dossierIndex,
                        fileIndex: k + 1,
                        fileCount,
                        rowNumber,
                        dossierFolderPath,
                    },
                );
                const cell = sheet.getCell(r, colNum);
                cell.value = value;
                applyDataCellStyle(cell, { isDossierCol });
            });
        }

        currentRow += dossierRowCount;
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
