export const DOCUMENT_NAMING_TARGET_TYPES = ["dossier", "file"] as const;
export type DocumentNamingTargetType =
    (typeof DOCUMENT_NAMING_TARGET_TYPES)[number];

export const DOCUMENT_NAMING_SEGMENT_SOURCES = [
    "fixed",
    "auto_increment",
    "year",
    "fond_field",
    "dossier_field",
    "file_field",
] as const;
export type DocumentNamingSegmentSource =
    (typeof DOCUMENT_NAMING_SEGMENT_SOURCES)[number];

export type DocumentNamingSegment = {
    length: number;
    source: DocumentNamingSegmentSource;
    value?: string | null;
    fieldKey?: string | null;
    padChar?: string | null;
};

export type DocumentNamingFieldOption = {
    key: string;
    label: string;
};

export type DocumentNamingFieldCatalog = {
    fond: DocumentNamingFieldOption[];
    dossier: DocumentNamingFieldOption[];
    file: DocumentNamingFieldOption[];
};

export const DOCUMENT_NAMING_FIELD_CATALOG: DocumentNamingFieldCatalog = {
    fond: [
        { key: "id", label: "Mã phông" },
        { key: "fondName", label: "Tên phông" },
        { key: "archiveAgency", label: "Cơ quan lưu trữ" },
        { key: "fondType", label: "Loại phông" },
    ],
    dossier: [
        { key: "name", label: "Tên hồ sơ" },
        { key: "folderPath", label: "Đường dẫn thư mục" },
        { key: "projectCode", label: "Mã dự án" },
        { key: "dossierTypeId", label: "Loại hồ sơ" },
    ],
    file: [
        { key: "fileName", label: "Tên file" },
        { key: "documentTypeId", label: "Loại tài liệu" },
    ],
};

function padSegmentValue(
    value: string,
    length: number,
    padChar: string,
): string {
    if (length <= 0) return value;
    const char = padChar.length > 0 ? padChar[0] : " ";
    const raw = value.slice(0, length);
    if (raw.length >= length) return raw;
    const padding = char.repeat(length - raw.length);
    return `${padding}${raw}`;
}

export function validateDocumentNamingSegments(
    segments: DocumentNamingSegment[],
): void {
    if (segments.length === 0) {
        throw new Error("At least one naming segment is required");
    }

    for (const [index, segment] of segments.entries()) {
        if (!Number.isInteger(segment.length) || segment.length < 0) {
            throw new Error(`Segment ${index + 1}: length must be a non-negative integer`);
        }

        if (segment.source === "fixed" || segment.source === "auto_increment") {
            if (!segment.value?.trim()) {
                throw new Error(`Segment ${index + 1}: value is required`);
            }
        }

        if (
            segment.source === "fond_field" ||
            segment.source === "dossier_field" ||
            segment.source === "file_field"
        ) {
            if (!segment.fieldKey?.trim()) {
                throw new Error(`Segment ${index + 1}: fieldKey is required`);
            }
        }

        if (segment.padChar != null && segment.padChar.length > 1) {
            throw new Error(`Segment ${index + 1}: padChar must be a single character`);
        }
    }
}

export function buildDocumentNamePreview(input: {
    segments: DocumentNamingSegment[];
    fond?: Record<string, string | null | undefined>;
    dossier?: Record<string, string | null | undefined>;
    file?: Record<string, string | null | undefined>;
    year?: number;
    autoIncrementCounter?: number;
}): string {
    const year = input.year ?? new Date().getFullYear();
    const counter = input.autoIncrementCounter ?? 1;

    return input.segments.map((segment) => {
        const padChar = segment.padChar ?? "";
        let raw = "";

        switch (segment.source) {
            case "fixed":
                raw = segment.value ?? "";
                break;
            case "auto_increment":
                raw = String(counter);
                break;
            case "year":
                raw = String(year);
                break;
            case "fond_field":
                raw = String(input.fond?.[segment.fieldKey ?? ""] ?? "");
                break;
            case "dossier_field":
                raw = String(input.dossier?.[segment.fieldKey ?? ""] ?? "");
                break;
            case "file_field":
                raw = String(input.file?.[segment.fieldKey ?? ""] ?? "");
                break;
        }

        if (segment.length === 0) return raw;
        return padSegmentValue(raw, segment.length, padChar);
    }).join("");
}
