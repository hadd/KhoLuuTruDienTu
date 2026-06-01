import ExcelJS from "exceljs";
import type { DossierMetadata, MetadataField, MetadataGroup } from "./metadata-types.ts";

const COLORS = {
    headerBlue: "FF4472C4",
    sectionBlue: "FF2F5496",
    zebra: "FFF2F2F2",
    sourceGray: "FFE7E6E6",
    subHeader: "FFD9E2F3",
    white: "FFFFFFFF",
} as const;

const DETAIL_COLUMNS = ["STT", "Tên trường", "Giá trị", "Trang"] as const;
const DETAIL_COL_COUNT = DETAIL_COLUMNS.length;

const OVERVIEW_HEADERS = ["STT", "Mã nhóm", "Tên nhóm", "File nguồn", "Số trường có dữ liệu"] as const;
const OVERVIEW_COL_COUNT = OVERVIEW_HEADERS.length;

function applyThinBorder(cell: ExcelJS.Cell) {
    cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
    };
}

function styleHeaderRow(row: ExcelJS.Row, bgColor: string = COLORS.headerBlue, colCount?: number) {
    const lastCol = colCount ?? row.cellCount;
    for (let col = 1; col <= lastCol; col++) {
        const cell = row.getCell(col);
        cell.font = { bold: true, color: { argb: COLORS.white } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        applyThinBorder(cell);
    }
}

function setOverviewColumnWidths(sheet: ExcelJS.Worksheet) {
    sheet.getColumn(1).width = 6;
    sheet.getColumn(2).width = 24;
    sheet.getColumn(3).width = 28;
    sheet.getColumn(4).width = 30;
    sheet.getColumn(5).width = 22;
}

export function extractRecordIndex(fieldName: string): number | null {
    const startMatch = fieldName.match(/^_(\d+)_/);
    if (startMatch) {
        return Number.parseInt(startMatch[1], 10);
    }

    const midMatch = fieldName.match(/_(\d+)_/);
    if (midMatch) {
        return Number.parseInt(midMatch[1], 10);
    }

    return null;
}

export function formatFieldLabel(name: string, display?: string): string {
    const base = display || name;
    const withoutIndex = base.replace(/^_(\d+)_/, "").replace(/_(\d+)_/, "_");
    return withoutIndex.replace(/_/g, " ").trim();
}

export interface FieldRecordGroup {
    index: number | null;
    fields: MetadataField[];
}

export function groupFieldsByRecordIndex(fields: MetadataField[]): FieldRecordGroup[] {
    const groups: FieldRecordGroup[] = [];
    let current: FieldRecordGroup | null = null;

    for (const field of fields) {
        const index = extractRecordIndex(field.name);

        if (!current || current.index !== index) {
            current = { index, fields: [field] };
            groups.push(current);
            continue;
        }

        current.fields.push(field);
    }

    return groups;
}

function countFieldsWithValue(group: MetadataGroup): number {
    return group.fields.filter((field) => field.value !== null && field.value !== "").length;
}

function formatCellValue(value: string | null | undefined): string {
    if (value === null || value === undefined) {
        return "";
    }
    return String(value);
}

function buildOverviewSheet(workbook: ExcelJS.Workbook, metadata: DossierMetadata) {
    const sheet = workbook.addWorksheet("Tổng quan");
    setOverviewColumnWidths(sheet);

    sheet.mergeCells(1, 1, 1, OVERVIEW_COL_COUNT);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = "XUẤT METADATA HỒ SƠ";
    titleCell.font = { bold: true, size: 16, color: { argb: COLORS.sectionBlue } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 28;

    sheet.getCell(3, 1).value = "Mã hồ sơ";
    sheet.getCell(3, 1).font = { bold: true };
    sheet.mergeCells(3, 2, 3, OVERVIEW_COL_COUNT);
    sheet.getCell(3, 2).value = formatCellValue(metadata.ho_so_id);
    sheet.getCell(3, 2).alignment = { vertical: "middle" };

    sheet.getCell(4, 1).value = "Trạng thái hồ sơ";
    sheet.getCell(4, 1).font = { bold: true };
    sheet.mergeCells(4, 2, 4, OVERVIEW_COL_COUNT);
    sheet.getCell(4, 2).value = formatCellValue(metadata.trang_thai_ho_so);
    sheet.getCell(4, 2).alignment = { vertical: "middle" };

    const headerRow = sheet.getRow(6);
    OVERVIEW_HEADERS.forEach((header, index) => {
        headerRow.getCell(index + 1).value = header;
    });
    styleHeaderRow(headerRow, COLORS.headerBlue, OVERVIEW_COL_COUNT);
    headerRow.height = 24;

    metadata.metadata_groups.forEach((group, index) => {
        const row = sheet.getRow(7 + index);
        row.getCell(1).value = index + 1;
        row.getCell(2).value = group.group_code;
        row.getCell(3).value = group.group_name;
        row.getCell(4).value = group.source_document?.file_name ?? "";
        row.getCell(5).value = countFieldsWithValue(group);

        for (let col = 1; col <= OVERVIEW_COL_COUNT; col++) {
            const cell = row.getCell(col);
            applyThinBorder(cell);
            cell.alignment = {
                vertical: "middle",
                horizontal: col === 1 || col === 5 ? "center" : "left",
                wrapText: col === 3 || col === 4,
            };
        }
    });
}

function buildDetailSheet(workbook: ExcelJS.Workbook, metadata: DossierMetadata) {
    const sheet = workbook.addWorksheet("Chi tiết");
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    let rowNumber = 1;

    for (const group of metadata.metadata_groups) {
        sheet.mergeCells(rowNumber, 1, rowNumber, DETAIL_COL_COUNT);
        const sectionRow = sheet.getRow(rowNumber);
        sectionRow.getCell(1).value = group.group_name;
        sectionRow.getCell(1).font = { bold: true, color: { argb: COLORS.white }, size: 12 };
        sectionRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.sectionBlue } };
        sectionRow.getCell(1).alignment = { vertical: "middle" };
        sectionRow.height = 22;
        rowNumber++;

        sheet.mergeCells(rowNumber, 1, rowNumber, DETAIL_COL_COUNT);
        const sourceRow = sheet.getRow(rowNumber);
        const sourceFileName = group.source_document?.file_name;
        sourceRow.getCell(1).value = sourceFileName
            ? `Tài liệu: ${sourceFileName}`
            : "(Chưa có tài liệu)";
        sourceRow.getCell(1).font = { italic: true, color: { argb: "FF595959" } };
        sourceRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.sourceGray } };
        rowNumber++;

        const headerRow = sheet.getRow(rowNumber);
        DETAIL_COLUMNS.forEach((header, colIndex) => {
            headerRow.getCell(colIndex + 1).value = header;
        });
        styleHeaderRow(headerRow, COLORS.headerBlue, DETAIL_COL_COUNT);
        rowNumber++;

        const recordGroups = groupFieldsByRecordIndex(group.fields);
        let fieldCounter = 0;

        for (const recordGroup of recordGroups) {
            if (recordGroup.index !== null) {
                sheet.mergeCells(rowNumber, 1, rowNumber, DETAIL_COL_COUNT);
                const subHeaderRow = sheet.getRow(rowNumber);
                subHeaderRow.getCell(1).value = `Bản ghi #${recordGroup.index}`;
                subHeaderRow.getCell(1).font = { bold: true };
                subHeaderRow.getCell(1).fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: COLORS.subHeader },
                };
                rowNumber++;
            }

            for (const field of recordGroup.fields) {
                fieldCounter++;
                const dataRow = sheet.getRow(rowNumber);
                const isZebra = fieldCounter % 2 === 0;

                dataRow.getCell(1).value = fieldCounter;
                dataRow.getCell(2).value = formatFieldLabel(field.name, field.display);
                dataRow.getCell(3).value = formatCellValue(field.value);
                dataRow.getCell(4).value = field.page ?? "";

                dataRow.eachCell((cell, colNumber) => {
                    applyThinBorder(cell);
                    if (isZebra) {
                        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.zebra } };
                    }
                    if (colNumber === 3) {
                        cell.alignment = { wrapText: true, vertical: "top" };
                    }
                    if (colNumber === 1 || colNumber === 4) {
                        cell.alignment = { horizontal: "center", vertical: "top" };
                    }
                });

                rowNumber++;
            }
        }

        rowNumber++;
    }

    sheet.getColumn(1).width = 8;
    sheet.getColumn(2).width = 35;
    sheet.getColumn(3).width = 50;
    sheet.getColumn(4).width = 10;
}

export async function buildMetadataExcel(metadata: DossierMetadata): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sohoa Backend";
    workbook.created = new Date();

    buildOverviewSheet(workbook, metadata);
    buildDetailSheet(workbook, metadata);

    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer as ArrayBuffer);
}
