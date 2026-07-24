export const DOCUMENT_NAMING_TARGET_TYPES = ["dossier", "file"] as const;
export type DocumentNamingTargetType =
    (typeof DOCUMENT_NAMING_TARGET_TYPES)[number];

export const DOCUMENT_NAMING_SEGMENT_SOURCES = [
    "fixed",
    "auto_increment",
    "year",
    "month",
    "day",
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
    if (value.length > length) return value;
    const char = padChar.length > 0 ? padChar[0] : " ";
    const padding = char.repeat(length - value.length);
    return `${padding}${value}`;
}

function resolveDatePart(
    source: "year" | "month" | "day",
    referenceDate: Date,
): string {
    switch (source) {
        case "year":
            return String(referenceDate.getFullYear());
        case "month":
            return String(referenceDate.getMonth() + 1);
        case "day":
            return String(referenceDate.getDate());
    }
}

export function validateDocumentNamingSegments(
    segments: DocumentNamingSegment[],
): void {
    if (segments.length === 0) {
        throw new Error("At least one naming segment is required");
    }

    for (const [index, segment] of segments.entries()) {
        if (!Number.isInteger(segment.length) || segment.length < 1) {
            throw new Error(`Segment ${index + 1}: length must be a positive integer`);
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
    autoIncrementCounter?: number;
    referenceDate?: Date;
}): string {
    const counter = input.autoIncrementCounter ?? 1;
    const referenceDate = input.referenceDate ?? new Date();

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
            case "month":
            case "day":
                raw = resolveDatePart(segment.source, referenceDate);
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

        return padSegmentValue(raw, segment.length, padChar);
    }).join("");
}

export function buildDocumentNamePreviewSamples(input: {
    segments: DocumentNamingSegment[];
    fond?: Record<string, string | null | undefined>;
    dossier?: Record<string, string | null | undefined>;
    file?: Record<string, string | null | undefined>;
    autoIncrementStart?: number;
    referenceDate?: Date;
}): string[] {
    const start = input.autoIncrementStart ?? 1;
    const hasAutoIncrement = input.segments.some(
        (segment) => segment.source === "auto_increment",
    );
    const previewInput = {
        segments: input.segments,
        fond: input.fond,
        dossier: input.dossier,
        file: input.file,
        referenceDate: input.referenceDate,
    };

    if (!hasAutoIncrement) {
        return [buildDocumentNamePreview({
            ...previewInput,
            autoIncrementCounter: start,
        })];
    }

    return [0, 1, 2].map((offset) => buildDocumentNamePreview({
        ...previewInput,
        autoIncrementCounter: start + offset,
    }));
}
