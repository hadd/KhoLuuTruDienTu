import { assertEquals } from "@std/assert";
import ExcelJS from "exceljs";
import {
    excelCellToDateString,
    excelCellToString,
    formatDateValue,
    sanitizeDateInput,
} from "../libs/helpers/excel-cell.ts";

function cellFromValue(value: unknown): ExcelJS.Cell {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("test");
    const cell = sheet.getCell(1, 1);
    cell.value = value as ExcelJS.CellValue;
    return cell;
}

Deno.test("excelCellToString reads plain string email", () => {
    const cell = cellFromValue("user@example.com");
    assertEquals(excelCellToString(cell), "user@example.com");
});

Deno.test("excelCellToString reads hyperlink email object", () => {
    const cell = cellFromValue({
        text: "user@example.com",
        hyperlink: "mailto:user@example.com",
    });
    assertEquals(excelCellToString(cell), "user@example.com");
});

Deno.test("excelCellToString reads rich text", () => {
    const cell = cellFromValue({
        richText: [
            { text: "hello@" },
            { text: "example.com" },
        ],
    });
    assertEquals(excelCellToString(cell), "hello@example.com");
});

Deno.test("sanitizeDateInput strips Excel time suffix", () => {
    assertEquals(sanitizeDateInput("16/10/2003 12:00:00 AM"), "16/10/2003");
});

Deno.test("excelCellToDateString formats Date cell as ISO", () => {
    const cell = cellFromValue(new Date(1990, 0, 15));
    assertEquals(excelCellToDateString(cell), "1990-01-15");
});

Deno.test("excelCellToDateString prefers Date value over locale display text", () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("test");
    const cell = sheet.getCell(1, 1);
    cell.value = new Date(1990, 0, 15);
    cell.numFmt = "dd/mm/yyyy";
    assertEquals(excelCellToDateString(cell), formatDateValue(new Date(1990, 0, 15)));
});

Deno.test("excelCellToString falls back to mailto hyperlink when text is empty", () => {
    const cell = cellFromValue({
        hyperlink: "mailto:fallback@example.com",
    });
    assertEquals(excelCellToString(cell), "fallback@example.com");
});
