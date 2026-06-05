import type ExcelJS from "exceljs";

/** Formats calendar date from ExcelJS Date cell (local midnight). */
export function formatDateValue(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/** Strips Excel time suffix and normalizes separators for parsing. */
export function sanitizeDateInput(raw: string): string {
    let s = raw.trim();
    s = s.replace(/[\u2013\u2014\u2212]/g, "-");
    s = s.replace(/\uFF0F/g, "/");
    s = s.replace(/\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?$/i, "");
    return s.trim();
}

/** Converts Excel serial day number to YYYY-MM-DD (1900 date system). */
export function excelSerialToDateString(serial: number): string {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + Math.round(serial) * 86_400_000);
    return formatDateValue(date);
}

function hyperlinkFromUrl(url: string): string {
    const trimmed = url.trim();
    if (/^mailto:/i.test(trimmed)) {
        return trimmed.replace(/^mailto:/i, "");
    }
    return trimmed;
}

function valueToString(value: unknown): string {
    if (value === null || value === undefined) {
        return "";
    }
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    if (value instanceof Date) {
        return formatDateValue(value);
    }
    if (typeof value !== "object") {
        return String(value);
    }

    const obj = value as Record<string, unknown>;

    if (typeof obj.text === "string" && obj.text.length > 0) {
        return obj.text;
    }

    if (Array.isArray(obj.richText)) {
        return (obj.richText as Array<{ text?: string }>)
            .map((part) => part.text ?? "")
            .join("");
    }

    if ("result" in obj) {
        return valueToString(obj.result);
    }

    if (typeof obj.hyperlink === "string" && obj.hyperlink.length > 0) {
        return hyperlinkFromUrl(obj.hyperlink);
    }

    return "";
}

/** Normalizes an ExcelJS cell to a plain string (handles hyperlinks, rich text, formulas). */
export function excelCellToString(cell: ExcelJS.Cell): string {
    const value = cell.value;

    if (value !== null && value !== undefined && typeof value === "object" && !(value instanceof Date)) {
        const fromValue = valueToString(value);
        if (fromValue) {
            return fromValue.trim();
        }
    }

    const text = cell.text?.trim();
    if (text) {
        return text;
    }

    return valueToString(value).trim();
}

function isLikelyExcelDateSerial(value: number): boolean {
    return Number.isFinite(value) && value >= 1000 && value < 100_000 && Math.floor(value) === value;
}

/** Reads a date cell as display text for validation (Date, serial, or typed text). */
export function excelCellToDateString(cell: ExcelJS.Cell): string {
    const value = cell.value;

    if (value instanceof Date) {
        return formatDateValue(value);
    }

    if (typeof value === "number" && isLikelyExcelDateSerial(value)) {
        return excelSerialToDateString(value);
    }

    let raw = "";
    if (typeof value === "string") {
        raw = value;
    } else if (value !== null && value !== undefined) {
        raw = valueToString(value);
    }
    if (!raw.trim()) {
        raw = cell.text ?? "";
    }

    return sanitizeDateInput(raw);
}
