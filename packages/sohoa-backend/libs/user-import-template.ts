import ExcelJS from "exceljs";
import { sanitizeDateInput } from "./helpers/excel-cell.ts";

export const USER_IMPORT_SHEET_GUIDE = "HuongDan";
export const USER_IMPORT_SHEET_IMPORT = "Import";
/** Legacy single-sheet template name */
export const USER_IMPORT_SHEET_USERS = "Users";

export const USER_IMPORT_HEADERS = [
    "Email",
    "Password",
    "Full Name",
    "Phone",
    "Address",
    "Role",
    "Gender",
    "DateOfBirth",
] as const;

/** Export template: same as import but without password (hashes are not exported). */
export const USER_EXPORT_HEADERS = [
    "Email",
    "Full Name",
    "Phone",
    "Address",
    "Role",
    "Gender",
    "DateOfBirth",
] as const;

/** Vietnamese labels for import validation errors (API / logs). */
export const USER_IMPORT_COLUMN_LABELS = [
    "",
    "Email",
    "Mật khẩu",
    "Họ và tên",
    "Số điện thoại",
    "Địa chỉ",
    "Vai trò",
    "Giới tính",
    "Ngày sinh",
] as const;

export const USER_IMPORT_ERROR_SHEET_TITLE = "IMPORT THẤT BẠI - LỖI KIỂM TRA DỮ LIỆU";
export const USER_IMPORT_ERROR_SHEET_NAME = "DongLoi";

/** Role IDs allowed in user import (must exist in DB). */
export const USER_IMPORT_ALLOWED_ROLES = ["qc", "admin", "editor"] as const;

export type UserImportAllowedRole = (typeof USER_IMPORT_ALLOWED_ROLES)[number];

const USER_IMPORT_ROLE_LIST_FORMULA = `"${USER_IMPORT_ALLOWED_ROLES.join(",")}"`;

/** Example emails on guide rows (legacy templates); import skips matching rows. */
export const USER_IMPORT_GUIDE_EXAMPLE_EMAILS = new Set([
    "user@example.com",
    "example@domain.com",
    "mau@vidu.com",
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HEADER_NOTES: Record<string, string> = {
    Email: "Bắt buộc. Định dạng email hợp lệ (vd: user@domain.com).",
    Password: "Bắt buộc. Tối thiểu 8 ký tự.",
    "Full Name": "Tùy chọn. Họ và tên.",
    Phone: "Tùy chọn. 10 số (0912345678) hoặc 9 số nếu Excel bỏ số 0 đầu (912345678).",
    Address: "Tùy chọn.",
    Role: "Tùy chọn. Chỉ được chọn: qc, admin, editor. Để trống = editor (mặc định).",
    Gender: "Tùy chọn. male | female | other | unspecified.",
    DateOfBirth: "Tùy chọn. DD/MM/YYYY, DD-MM-YYYY hoặc YYYY-MM-DD (vd: 16/10/2003). Không dùng khoảng trắng (1996 12 1).",
};

const GUIDE_ROWS: Array<[string, string, string]> = [
    ["Email", "Bắt buộc", "user@domain.com"],
    ["Password", "Bắt buộc, ≥ 8 ký tự", "MatKhau123"],
    ["Full Name", "Tùy chọn", "Nguyễn Văn A"],
    ["Phone", "Tùy chọn. 10 số (0...) hoặc 9 số khi Excel bỏ 0 đầu", "0912345678"],
    ["Address", "Tùy chọn", "123 Đường ABC, Quận 1"],
    ["Role", "Tùy chọn. Chỉ: qc | admin | editor (mặc định editor)", "editor"],
    ["Gender", "male | female | other | unspecified", "male"],
    ["DateOfBirth", "DD/MM/YYYY hoặc YYYY-MM-DD", "16/10/2003"],
];

function styleHeaderRow(row: ExcelJS.Row): void {
    row.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF4472C4" },
        };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    row.height = 22;
}

function autofitColumns(sheet: ExcelJS.Worksheet, maxWidth = 50): void {
    sheet.columns.forEach((column) => {
        let maxLength = 10;
        column.eachCell?.({ includeEmpty: true }, (cell) => {
            const cellLength = String(cell.value ?? "").length;
            if (cellLength > maxLength) {
                maxLength = cellLength;
            }
        });
        column.width = Math.min(maxLength + 2, maxWidth);
    });
}

export interface UserImportGuideRowCheck {
    email: string;
    password: string;
    fullName: string;
}

export type NormalizeUserImportPhoneResult =
    | { ok: true; phone: string }
    | { ok: false };

/** Normalizes VN mobile: 0 + 9 digits, or 9 digits when Excel drops the leading 0. */
export type NormalizeUserImportDateResult =
    | { ok: true; date: string }
    | { ok: false };

function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
    const d = new Date(year, month - 1, day);
    return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

function tryDmyParts(day: number, month: number, year: number): NormalizeUserImportDateResult {
    if (isValidCalendarDate(year, month, day)) {
        return { ok: true, date: `${year}-${pad2(month)}-${pad2(day)}` };
    }
    return { ok: false };
}

/** Parses first/second as DD/MM (VN); falls back to MM/DD only when needed. */
function parseDmyOrMdY(a: number, b: number, year: number): NormalizeUserImportDateResult {
    if (a > 12 && b <= 12) {
        return tryDmyParts(a, b, year);
    }
    if (b > 12 && a <= 12) {
        return tryDmyParts(b, a, year);
    }
    const dmy = tryDmyParts(a, b, year);
    if (dmy.ok) {
        return dmy;
    }
    if (a <= 12 && b <= 12) {
        return tryDmyParts(b, a, year);
    }
    return { ok: false };
}

/** Parses DOB text to YYYY-MM-DD (ISO, DD/MM/YYYY, DD-MM-YYYY, Excel text with time). */
export function normalizeUserImportDate(raw: string): NormalizeUserImportDateResult {
    const trimmed = sanitizeDateInput(raw);
    if (!trimmed) {
        return { ok: false };
    }

    const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
        return tryDmyParts(Number(iso[3]), Number(iso[2]), Number(iso[1]));
    }

    const dmySep = trimmed.match(/^(\d{1,2})([\/\-.])(\d{1,2})\2(\d{4})$/);
    if (dmySep) {
        return parseDmyOrMdY(Number(dmySep[1]), Number(dmySep[3]), Number(dmySep[4]));
    }

    return { ok: false };
}

export function normalizeUserImportPhone(raw: string): NormalizeUserImportPhoneResult {
    let cleaned = raw.trim().replace(/[\s\-]/g, "");
    cleaned = cleaned.replace(/\.0+$/, "");
    if (/^0\d{9}$/.test(cleaned)) {
        return { ok: true, phone: cleaned };
    }
    if (/^\d{9}$/.test(cleaned)) {
        return { ok: true, phone: `0${cleaned}` };
    }
    return { ok: false };
}

export function isUserImportAllowedRole(role: string): role is UserImportAllowedRole {
    const normalized = role.trim().toLowerCase();
    return (USER_IMPORT_ALLOWED_ROLES as readonly string[]).includes(normalized);
}

export function normalizeUserImportRole(role: string): UserImportAllowedRole | "" {
    const normalized = role.trim().toLowerCase();
    if (!normalized) return "";
    return isUserImportAllowedRole(normalized) ? normalized : "";
}

/** Skips legacy example/guide rows on a single data sheet. */
export function isUserImportGuideRow(row: UserImportGuideRowCheck): boolean {
    const email = row.email.trim().toLowerCase();
    if (email && USER_IMPORT_GUIDE_EXAMPLE_EMAILS.has(email)) {
        return true;
    }
    const password = row.password.trim();
    const fullName = row.fullName.trim();
    if (email && !password && !fullName && !EMAIL_REGEX.test(email)) {
        return true;
    }
    return false;
}

export function resolveUserImportWorksheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
    return workbook.getWorksheet(USER_IMPORT_SHEET_IMPORT)
        ?? workbook.getWorksheet(USER_IMPORT_SHEET_USERS)
        ?? workbook.worksheets[0];
}

export function buildUserImportTemplateWorkbook(): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sohoa";
    workbook.created = new Date();

    const guideSheet = workbook.addWorksheet(USER_IMPORT_SHEET_GUIDE);
    guideSheet.addRow(["Hướng dẫn import người dùng"]);
    guideSheet.mergeCells(1, 1, 1, 3);
    const titleCell = guideSheet.getCell(1, 1);
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: "center" };

    guideSheet.addRow([]);
    guideSheet.addRow(["Cột", "Quy tắc", "Ví dụ"]);
    styleHeaderRow(guideSheet.getRow(3));

    for (const [colName, rule, example] of GUIDE_ROWS) {
        guideSheet.addRow([colName, rule, example]);
    }

    guideSheet.addRow([]);
    guideSheet.addRow([
        "Lưu ý: Nhập dữ liệu trên sheet \"Import\" từ dòng 2 trở đi. Không sửa dòng tiêu đề (dòng 1). Sheet này chỉ để tham khảo.",
    ]);
    guideSheet.mergeCells(guideSheet.rowCount, 1, guideSheet.rowCount, 3);
    guideSheet.getCell(guideSheet.rowCount, 1).alignment = { wrapText: true };

    autofitColumns(guideSheet);

    const importSheet = workbook.addWorksheet(USER_IMPORT_SHEET_IMPORT);
    const headerRow = importSheet.addRow([...USER_IMPORT_HEADERS]);
    styleHeaderRow(headerRow);

    headerRow.eachCell((cell, colNumber) => {
        const header = USER_IMPORT_HEADERS[colNumber - 1];
        if (header && HEADER_NOTES[header]) {
            cell.note = HEADER_NOTES[header];
        }
    });

    importSheet.getColumn(1).numFmt = "@";
    importSheet.getColumn(1).width = 28;
    importSheet.getColumn(4).numFmt = "@";

    for (let r = 2; r <= 500; r++) {
        importSheet.getCell(r, 6).dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: [USER_IMPORT_ROLE_LIST_FORMULA],
            showErrorMessage: true,
            errorTitle: "Vai trò không hợp lệ",
            error: "Chỉ được chọn: qc, admin, editor",
        };
        importSheet.getCell(r, 7).dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: ['"male,female,other,unspecified"'],
            showErrorMessage: true,
            errorTitle: "Giới tính không hợp lệ",
            error: "Chọn: male, female, other, hoặc unspecified",
        };
    }

    autofitColumns(importSheet);

    workbook.views = [{
        x: 0,
        y: 0,
        width: 20000,
        height: 12000,
        firstSheet: 1,
        activeTab: 1,
        visibility: "visible",
    }];

    return workbook;
}

export async function buildUserImportTemplateBuffer(): Promise<Uint8Array> {
    const workbook = buildUserImportTemplateWorkbook();
    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer as ArrayBuffer);
}
