import { assertEquals, assertExists } from "@std/assert";
import ExcelJS from "exceljs";
import { excelCellToString } from "../libs/helpers/excel-cell.ts";
import {
    buildUserImportTemplateBuffer,
    buildUserImportTemplateWorkbook,
    isUserImportAllowedRole,
    isUserImportGuideRow,
    normalizeUserImportDate,
    normalizeUserImportPhone,
    resolveUserImportWorksheet,
    USER_IMPORT_ALLOWED_ROLES,
    USER_IMPORT_HEADERS,
    USER_IMPORT_SHEET_GUIDE,
    USER_IMPORT_SHEET_IMPORT,
} from "../libs/user-import-template.ts";

Deno.test("buildUserImportTemplateWorkbook has HuongDan and Import sheets", () => {
    const workbook = buildUserImportTemplateWorkbook();
    assertExists(workbook.getWorksheet(USER_IMPORT_SHEET_GUIDE));
    assertExists(workbook.getWorksheet(USER_IMPORT_SHEET_IMPORT));
    assertEquals(resolveUserImportWorksheet(workbook)?.name, USER_IMPORT_SHEET_IMPORT);
});

Deno.test("Import sheet row 1 matches USER_IMPORT_HEADERS", () => {
    const sheet = buildUserImportTemplateWorkbook().getWorksheet(USER_IMPORT_SHEET_IMPORT)!;
    USER_IMPORT_HEADERS.forEach((header, index) => {
        assertEquals(excelCellToString(sheet.getRow(1).getCell(index + 1)), header);
    });
});

Deno.test("buildUserImportTemplateBuffer round-trips as xlsx", async () => {
    const buffer = await buildUserImportTemplateBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer as ArrayBuffer);
    assertExists(workbook.getWorksheet(USER_IMPORT_SHEET_IMPORT));
});

Deno.test("normalizeUserImportDate accepts ISO and DD/MM/YYYY", () => {
    assertEquals(normalizeUserImportDate("1990-01-15"), { ok: true, date: "1990-01-15" });
    assertEquals(normalizeUserImportDate("15/01/1990"), { ok: true, date: "1990-01-15" });
    assertEquals(normalizeUserImportDate("15-01-1990"), { ok: true, date: "1990-01-15" });
});

Deno.test("normalizeUserImportDate rejects invalid dates", () => {
    assertEquals(normalizeUserImportDate("32/01/1990").ok, false);
    assertEquals(normalizeUserImportDate("1990-13-01").ok, false);
    assertEquals(normalizeUserImportDate("not-a-date").ok, false);
    assertEquals(normalizeUserImportDate("1996 12 1").ok, false);
});

Deno.test("normalizeUserImportDate accepts Excel text with time suffix", () => {
    assertEquals(normalizeUserImportDate("16/10/2003 12:00:00 AM"), { ok: true, date: "2003-10-16" });
    assertEquals(normalizeUserImportDate("16-10-2003"), { ok: true, date: "2003-10-16" });
    assertEquals(normalizeUserImportDate("16.10.2003"), { ok: true, date: "2003-10-16" });
});

Deno.test("normalizeUserImportPhone accepts 10 digits with leading 0", () => {
    assertEquals(normalizeUserImportPhone("0912345678"), { ok: true, phone: "0912345678" });
    assertEquals(normalizeUserImportPhone("091-234-5678"), { ok: true, phone: "0912345678" });
});

Deno.test("normalizeUserImportPhone accepts 9 digits when Excel drops leading 0", () => {
    assertEquals(normalizeUserImportPhone("912345678"), { ok: true, phone: "0912345678" });
    assertEquals(normalizeUserImportPhone("912345678.0"), { ok: true, phone: "0912345678" });
});

Deno.test("normalizeUserImportPhone rejects invalid lengths", () => {
    assertEquals(normalizeUserImportPhone("12345").ok, false);
    assertEquals(normalizeUserImportPhone("09123456789").ok, false);
});

Deno.test("USER_IMPORT_ALLOWED_ROLES is qc, admin, editor", () => {
    assertEquals([...USER_IMPORT_ALLOWED_ROLES], ["qc", "admin", "editor"]);
    assertEquals(isUserImportAllowedRole("editor"), true);
    assertEquals(isUserImportAllowedRole("ADMIN"), true);
    assertEquals(isUserImportAllowedRole("superuser"), false);
});

Deno.test("isUserImportGuideRow skips example emails", () => {
    assertEquals(
        isUserImportGuideRow({ email: "user@example.com", password: "MatKhau123", fullName: "Mẫu" }),
        true,
    );
    assertEquals(
        isUserImportGuideRow({ email: "real.user@company.com", password: "MatKhau123", fullName: "Nguyen" }),
        false,
    );
});

Deno.test("import worksheet ignores HuongDan rows", () => {
    const workbook = buildUserImportTemplateWorkbook();
    const guideSheet = workbook.getWorksheet(USER_IMPORT_SHEET_GUIDE)!;
    guideSheet.addRow(["should-not-import@example.com", "Secret123", "Only on guide sheet"]);

    const importSheet = resolveUserImportWorksheet(workbook)!;
    importSheet.addRow([
        "imported@example.com",
        "Password1!",
        "Test User",
        "",
        "",
        "editor",
        "male",
        "",
    ]);

    const emails: string[] = [];
    importSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const email = excelCellToString(row.getCell(1)).trim();
        const password = excelCellToString(row.getCell(2)).trim();
        const fullName = excelCellToString(row.getCell(3)).trim();
        if (!email && !password && !fullName) return;
        if (isUserImportGuideRow({ email, password, fullName })) return;
        emails.push(email);
    });

    assertEquals(emails, ["imported@example.com"]);
});
