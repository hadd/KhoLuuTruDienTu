import { normalizeFieldDisplay, normalizeFieldName } from "./metadata-field-filter.ts";
import type { DossierMetadata, MetadataGroup } from "./metadata-types.ts";
import type { MetadataExportColumnConfig, MetadataExportFieldCatalogItem } from "./metadata-export-types.ts";
import {
    createExportSttColumn,
    isExportSttColumn,
} from "./metadata-export-types.ts";

const INSTANCE_JOIN_SEPARATOR = "\n";

export interface DossierFileItem {
    fileIndex: number;
    sourceDocument: { file_name: string | null; file_path: string | null };
    groups: MetadataGroup[];
}

export const TT05_DEFAULT_EXPORT_COLUMNS: MetadataExportColumnConfig[] = [
    { header: "STT", fieldKeys: ["__stt"], separator: "", headerColor: "8EAADB" },
    { header: "Mã định danh văn bản", fieldKeys: ["TAI_LIEU_LUU_TRU.MA_DINH_DANH_TAI_LIEU", "TAI_LIEU_LUU_TRU.MA_DINH_DANH_VAN_BAN", "TAI_LIEU_LUU_TRU.MA_VAN_BAN", "HO_SO_LUU_TRU.MA_DINH_DANH_VAN_BAN", "__file_identifier"], separator: "", headerColor: "8EAADB" },
    { header: "Mã hồ sơ", fieldKeys: ["HO_SO_LUU_TRU.MA_HO_SO", "HO_SO_LUU_TRU.MA_HO_SO_GOC_GIAY", "TAI_LIEU_LUU_TRU.MA_HO_SO", "__ho_so_id"], separator: "", headerColor: "8EAADB" },
    { header: "Mã cơ quan lưu trữ lịch sử", fieldKeys: ["HO_SO_LUU_TRU.MA_CO_QUAN_LUU_TRU_LICH_SU", "HO_SO_LUU_TRU.MA_CO_QUAN_LUU_TRU", "HO_SO_LUU_TRU.MA_CO_QUAN", "TAI_LIEU_LUU_TRU.MA_CO_QUAN_LUU_TRU_LICH_SU"], separator: "", headerColor: "8EAADB" },
    { header: "Mã phông/công trình/sưu tập lưu trữ", fieldKeys: ["HO_SO_LUU_TRU.FOND", "HO_SO_LUU_TRU.MA_PHONG", "HO_SO_LUU_TRU.PHONG_LUU_TRU", "TAI_LIEU_LUU_TRU.MA_PHONG"], separator: "", headerColor: "8EAADB" },
    { header: "Mục lục số hoặc năm hình thành hồ sơ", fieldKeys: ["HO_SO_LUU_TRU.MUC_LUC_SO", "HO_SO_LUU_TRU.NAM_HINH_THANH_HO_SO", "TAI_LIEU_LUU_TRU.MUC_LUC_SO"], separator: "", headerColor: "8EAADB" },
    { header: "Số và ký hiệu hồ sơ", fieldKeys: ["HO_SO_LUU_TRU.SO_VA_KY_HIEU_HO_SO", "HO_SO_LUU_TRU.SO_KY_HIEU_HO_SO", "TAI_LIEU_LUU_TRU.SO_VA_KY_HIEU_HO_SO", "TAI_LIEU_LUU_TRU.SO_KY_HIEU_HO_SO"], separator: "", headerColor: "FFFF00" },
    { header: "Tiêu đề hồ sơ", fieldKeys: ["HO_SO_LUU_TRU.TIEU_DE_HO_SO", "HO_SO_LUU_TRU.TIEU_DE", "TAI_LIEU_LUU_TRU.TIEU_DE_HO_SO"], separator: "", headerColor: "FFFF00" },
    { header: "Thời hạn bảo quản", fieldKeys: ["HO_SO_LUU_TRU.THOI_HAN_LUU_TRU", "HO_SO_LUU_TRU.THOI_HAN_BAO_QUAN"], separator: "", headerColor: "FFFF00" },
    { header: "Thời gian bắt đầu", fieldKeys: ["HO_SO_LUU_TRU.THOI_GIAN_BAT_DAU"], separator: "", headerColor: "FFFF00" },
    { header: "Thời gian kết thúc", fieldKeys: ["HO_SO_LUU_TRU.THOI_GIAN_KET_THUC"], separator: "", headerColor: "FFFF00" },
    { header: "Tổng số văn bản trong hồ sơ", fieldKeys: ["HO_SO_LUU_TRU.TONG_SO_VAN_BAN_TRONG_HO_SO", "HO_SO_LUU_TRU.TONG_SO_TAI_LIEU_TRONG_HO_SO", "HO_SO_LUU_TRU.TONG_SO_VAN_BAN", "__file_count"], separator: "", headerColor: "FFFF00" },
    { header: "Số lượng tờ", fieldKeys: ["HO_SO_LUU_TRU.SO_LUONG_TO"], separator: "", headerColor: "FFFF00" },
    { header: "Số lượng trang", fieldKeys: ["HO_SO_LUU_TRU.SO_LUONG_TRANG"], separator: "", headerColor: "FFFF00" },
    { header: "Số thứ tự văn bản trong hồ sơ", fieldKeys: ["TAI_LIEU_LUU_TRU.SO_THU_TU_VAN_BAN", "TAI_LIEU_LUU_TRU.STT_VAN_BAN", "TAI_LIEU_LUU_TRU.STT_VAN_BAN_TRONG_HO_SO", "__file_stt"], separator: "", headerColor: "FFFF00" },
    { header: "Tên loại văn bản", fieldKeys: ["TAI_LIEU_LUU_TRU.TEN_LOAI_TAI_LIEU", "TAI_LIEU_LUU_TRU.TEN_LOAI_VAN_BAN", "__document_type_name"], separator: "", headerColor: "A9CD90" },
    { header: "Số của văn bản", fieldKeys: ["TAI_LIEU_LUU_TRU.SO_CUA_VAN_BAN", "TAI_LIEU_LUU_TRU.SO_CUA_TAI_LIEU", "TAI_LIEU_LUU_TRU.SO_VAN_BAN", "BAN_AN_QUYET_DINH.SO_BAN_AN", "QUYET_DINH.SO_QD_THA"], separator: "", headerColor: "A9CD90" },
    { header: "Ký hiệu của văn bản", fieldKeys: ["TAI_LIEU_LUU_TRU.KY_HIEU_CUA_VAN_BAN", "TAI_LIEU_LUU_TRU.KY_HIEU_CUA_TAI_LIEU", "TAI_LIEU_LUU_TRU.KY_HIEU_VAN_BAN"], separator: "", headerColor: "A9CD90" },
    { header: "Ngày", fieldKeys: ["TAI_LIEU_LUU_TRU.NGAY", "__date_day"], separator: "", headerColor: "A9CD90" },
    { header: "Tháng", fieldKeys: ["TAI_LIEU_LUU_TRU.THANG", "__date_month"], separator: "", headerColor: "A9CD90" },
    { header: "Năm", fieldKeys: ["TAI_LIEU_LUU_TRU.NAM", "__date_year"], separator: "", headerColor: "A9CD90" },
    { header: "Ngày, tháng, năm văn bản", fieldKeys: ["TAI_LIEU_LUU_TRU.NGAY_THANG_NAM_BAN_HANH", "TAI_LIEU_LUU_TRU.NGAY_THANG_NAM_VAN_BAN", "BAN_AN_QUYET_DINH.NGAY_BAN_HANH_AN_QD", "QUYET_DINH.NGAY_QUYET_DINH"], separator: "", headerColor: "A9CD90" },
    { header: "Tên cơ quan, tổ chức ban hành văn bản", fieldKeys: ["TAI_LIEU_LUU_TRU.TEN_CO_QUAN_BAN_HANH", "BAN_AN_QUYET_DINH.CO_QUAN_BAN_HANH", "QUYET_DINH.CO_QUAN_BAN_HANH_QUYET_DINH"], separator: "", headerColor: "A9CD90" },
    { header: "Trích yếu nội dung", fieldKeys: ["TAI_LIEU_LUU_TRU.TRICH_YEU_NOI_DUNG"], separator: "", headerColor: "A9CD90" },
    { header: "Mức độ tin cậy", fieldKeys: ["TAI_LIEU_LUU_TRU.MUC_DO_TIN_CAY", "HO_SO_LUU_TRU.MUC_DO_TIN_CAY"], separator: "", headerColor: "A9CD90" },
    { header: "Ngôn ngữ", fieldKeys: ["TAI_LIEU_LUU_TRU.NGON_NGU", "HO_SO_LUU_TRU.NGON_NGU"], separator: "", headerColor: "A9CD90" },
    { header: "Trang số", fieldKeys: ["TAI_LIEU_LUU_TRU.TRANG_SO"], separator: "", headerColor: "A9CD90" },
    { header: "Số lượng trang của văn bản", fieldKeys: ["TAI_LIEU_LUU_TRU.SO_LUONG_TRANG_CUA_VAN_BAN", "TAI_LIEU_LUU_TRU.SO_LUONG_TRANG", "HO_SO_LUU_TRU.SO_LUONG_TRANG_CUA_VAN_BAN", "HO_SO_LUU_TRU.SO_LUONG_TRANG"], separator: "", headerColor: "A9CD90" },
    { header: "Loại tài liệu", fieldKeys: ["TAI_LIEU_LUU_TRU.LOAI_TAI_LIEU", "TAI_LIEU_LUU_TRU.TEN_LOAI_TAI_LIEU", "TAI_LIEU_LUU_TRU.TEN_LOAI_VAN_BAN", "HO_SO_LUU_TRU.LOAI_TAI_LIEU"], separator: "", headerColor: "A9CD90" },
    { header: "Chế độ sử dụng", fieldKeys: ["HO_SO_LUU_TRU.CHE_DO_SU_DUNG", "TAI_LIEU_LUU_TRU.CHE_DO_SU_DUNG", "TAI_LIEU_LUU_TRU.MUC_DO_TIEP_CAN", "HO_SO_LUU_TRU.MUC_DO_TIEP_CAN"], separator: "", headerColor: "A9CD90" },
    { header: "Tình trạng vật lý", fieldKeys: ["HO_SO_LUU_TRU.TINH_TRANG_VAT_LY", "TAI_LIEU_LUU_TRU.TINH_TRANG_VAT_LY"], separator: "", headerColor: "A9CD90" },
    { header: "Đường dẫn file", fieldKeys: ["TAI_LIEU_LUU_TRU.TEP_TIN_TAI_LIEU", "__file_path"], separator: "", headerColor: "A9CD90" },
];

const DOSSIER_HEADERS = new Set([
    "STT",
    "Mã hồ sơ",
    "Mã cơ quan lưu trữ lịch sử",
    "Mã phông/công trình/sưu tập lưu trữ",
    "Mục lục số hoặc năm hình thành hồ sơ",
    "Số và ký hiệu hồ sơ",
    "Tiêu đề hồ sơ",
    "Thời hạn bảo quản",
    "Thời gian bắt đầu",
    "Thời gian kết thúc",
    "Tổng số văn bản trong hồ sơ",
    "Số lượng tờ",
    "Số lượng trang",
]);

export function isDossierColumn(column: MetadataExportColumnConfig): boolean {
    if (isExportSttColumn(column)) {
        return true;
    }
    const headerTrim = column.header?.trim();
    if (headerTrim && DOSSIER_HEADERS.has(headerTrim)) {
        return true;
    }
    if (
        column.fieldKeys.some(
            (k) =>
                k.startsWith("TAI_LIEU_LUU_TRU.") ||
                k.startsWith("BAN_AN_QUYET_DINH.") ||
                k.startsWith("QUYET_DINH.") ||
                k.startsWith("BIEN_LAI.") ||
                k.startsWith("DUONG_SU.") ||
                k.startsWith("NGHIA_VU.") ||
                k.startsWith("__file_"),
        )
    ) {
        return false;
    }
    if (
        column.fieldKeys.length > 0 &&
        column.fieldKeys.every(
            (k) =>
                k.startsWith("HO_SO_LUU_TRU.") ||
                k.startsWith("PHONG_LUU_TRU."),
        )
    ) {
        return true;
    }
    return false;
}

export function extractDossierFileItems(metadata: DossierMetadata): DossierFileItem[] {
    const hoSoGroup = metadata.metadata_groups.find(
        (g) => g.group_code === "HO_SO_LUU_TRU",
    );

    const nonHoSoGroups = metadata.metadata_groups.filter(
        (g) => g.group_code !== "HO_SO_LUU_TRU",
    );

    const fileItems: DossierFileItem[] = [];
    let fileIdx = 1;

    for (const group of nonHoSoGroups) {
        const nestedDocs = group.documents ?? group.document;
        if (Array.isArray(nestedDocs) && nestedDocs.length > 0) {
            for (const doc of nestedDocs) {
                fileItems.push({
                    fileIndex: fileIdx++,
                    sourceDocument: doc.source_document ?? { file_name: null, file_path: null },
                    groups: [
                        {
                            group_code: group.group_code,
                            group_name: group.group_name,
                            source_document: doc.source_document ?? { file_name: null, file_path: null },
                            fields: doc.fields ?? [],
                        },
                    ],
                });
            }
        } else {
            fileItems.push({
                fileIndex: fileIdx++,
                sourceDocument: group.source_document ?? { file_name: null, file_path: null },
                groups: [group],
            });
        }
    }

    if (fileItems.length > 0) {
        return fileItems;
    }

    if (hoSoGroup) {
        return [
            {
                fileIndex: 1,
                sourceDocument: hoSoGroup.source_document ?? { file_name: null, file_path: null },
                groups: [],
            },
        ];
    }

    return [
        {
            fileIndex: 1,
            sourceDocument: { file_name: null, file_path: null },
            groups: [],
        },
    ];
}

export function sanitizeDatePart(val: string | null | undefined): string {
    if (!val) return "";
    const trimmed = val.trim();
    if (trimmed === "0" || trimmed === "00" || trimmed === "0000" || /^0+$/.test(trimmed)) {
        return "";
    }
    return trimmed;
}

export function formatDateStringToVn(dateStr: string): string {
    if (!dateStr) return "";
    const str = dateStr.trim();
    const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(str);
    if (isoMatch) {
        const year = isoMatch[1]!;
        const monthNum = Number(isoMatch[2]);
        const dayNum = Number(isoMatch[3]);
        if (monthNum === 0 && dayNum === 0) {
            return year === "0000" ? "" : year;
        }
        const month = String(monthNum).padStart(2, "0");
        const day = String(dayNum).padStart(2, "0");
        return `${day}/${month}/${year}`;
    }
    const vnMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str);
    if (vnMatch) {
        const day = vnMatch[1]!.padStart(2, "0");
        const month = vnMatch[2]!.padStart(2, "0");
        const year = vnMatch[3]!;
        return `${day}/${month}/${year}`;
    }
    return str;
}

function parseDateParts(dateStr: string | null | undefined): { day: string; month: string; year: string } {
    if (!dateStr) return { day: "", month: "", year: "" };
    const str = dateStr.trim();
    const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(str);
    if (isoMatch) {
        return {
            year: sanitizeDatePart(isoMatch[1]),
            month: sanitizeDatePart(String(Number(isoMatch[2]))),
            day: sanitizeDatePart(String(Number(isoMatch[3]))),
        };
    }
    const vnMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(str);
    if (vnMatch) {
        return {
            day: sanitizeDatePart(String(Number(vnMatch[1]))),
            month: sanitizeDatePart(String(Number(vnMatch[2]))),
            year: sanitizeDatePart(vnMatch[3]),
        };
    }
    return { day: "", month: "", year: "" };
}

function findFieldValueInGroups(groups: MetadataGroup[], fieldName: string): string | null {
    const canonical = normalizeFieldName(fieldName);
    for (const group of groups) {
        for (const field of group.fields) {
            if (normalizeFieldName(field.name) === canonical) {
                const val = field.value?.trim();
                if (val) return val;
            }
        }
    }
    return null;
}

function formatCellValue(value: string | null | undefined): string {
    if (value === null || value === undefined) {
        return "";
    }
    return formatDateStringToVn(String(value));
}

function parseFieldKey(fieldKey: string): { groupCode: string; fieldName: string } | null {
    const dotIndex = fieldKey.indexOf(".");
    if (dotIndex <= 0) {
        return null;
    }
    return {
        groupCode: fieldKey.slice(0, dotIndex),
        fieldName: fieldKey.slice(dotIndex + 1),
    };
}

export function fieldMatchesKey(fieldName: string, canonicalFieldName: string): boolean {
    return normalizeFieldName(fieldName) === canonicalFieldName;
}

export function extractBasenameFromPath(pathStr: string | null | undefined): string {
    if (!pathStr) return "";
    const clean = pathStr.trim();
    if (!clean) return "";
    const segments = clean.split(/[/\\]/).filter(Boolean);
    return segments.at(-1) ?? clean;
}

export function cleanFilePath(pathStr: string | null | undefined): string {
    if (!pathStr) return "";
    const clean = pathStr.trim();
    if (clean.startsWith("raw/") || clean.startsWith("raw\\")) {
        return clean.substring(4);
    }
    return clean;
}

export function resolveExportFieldValue(
    metadata: DossierMetadata,
    fieldKey: string,
): string {
    const parsed = parseFieldKey(fieldKey);
    if (!parsed) {
        return "";
    }

    const isDatePart = parsed.fieldName === "NGAY" || parsed.fieldName === "THANG" || parsed.fieldName === "NAM";
    const values: string[] = [];
    for (const group of metadata.metadata_groups) {
        if (group.group_code !== parsed.groupCode) {
            continue;
        }
        for (const field of group.fields ?? []) {
            if (!fieldMatchesKey(field.name, parsed.fieldName)) {
                continue;
            }
            const formatted = formatCellValue(field.value);
            if (formatted) {
                const finalVal = isDatePart ? sanitizeDatePart(formatted) : formatted;
                if (finalVal) {
                    values.push(finalVal);
                }
            }
        }
    }

    if (values.length > 0) {
        return values.join(INSTANCE_JOIN_SEPARATOR);
    }

    // Fallback: search across all metadata groups
    for (const group of metadata.metadata_groups) {
        for (const field of group.fields ?? []) {
            if (!fieldMatchesKey(field.name, parsed.fieldName)) {
                continue;
            }
            const formatted = formatCellValue(field.value);
            if (formatted) {
                const finalVal = isDatePart ? sanitizeDatePart(formatted) : formatted;
                if (finalVal) {
                    values.push(finalVal);
                }
            }
        }
    }

    if (values.length > 0) {
        return values.join(INSTANCE_JOIN_SEPARATOR);
    }

    // Fallback for MA_HO_SO from dossier ho_so_id
    if (parsed.fieldName === "MA_HO_SO" && metadata.ho_so_id) {
        return extractBasenameFromPath(metadata.ho_so_id);
    }

    return "";
}

export function resolveExportFieldValueForFileItem(
    metadata: DossierMetadata,
    fileItem: DossierFileItem,
    fieldKey: string,
): string {
    const parsed = parseFieldKey(fieldKey);

    if (!parsed) {
        if (fieldKey === "__file_path") {
            const fp = fileItem.sourceDocument.file_path ?? fileItem.sourceDocument.file_name ?? "";
            return cleanFilePath(fp);
        }
        if (fieldKey === "__file_identifier") {
            const idVal =
                findFieldValueInGroups(fileItem.groups, "MA_DINH_DANH_TAI_LIEU") ??
                findFieldValueInGroups(fileItem.groups, "MA_DINH_DANH_VAN_BAN");
            return idVal ?? fileItem.sourceDocument.file_name ?? "";
        }
        if (fieldKey === "__document_type_name") {
            return (
                findFieldValueInGroups(fileItem.groups, "TEN_LOAI_TAI_LIEU") ??
                findFieldValueInGroups(fileItem.groups, "TEN_LOAI_VAN_BAN") ??
                fileItem.groups[0]?.group_name ??
                ""
            );
        }
        if (
            fieldKey === "__date_day" ||
            fieldKey === "__date_month" ||
            fieldKey === "__date_year"
        ) {
            const fieldName =
                fieldKey === "__date_day"
                    ? "NGAY"
                    : fieldKey === "__date_month"
                    ? "THANG"
                    : "NAM";
            const direct = findFieldValueInGroups(fileItem.groups, fieldName);
            if (direct !== null) {
                return sanitizeDatePart(direct);
            }
            const dateStr =
                findFieldValueInGroups(fileItem.groups, "NGAY_THANG_NAM_BAN_HANH") ??
                findFieldValueInGroups(fileItem.groups, "NGAY_THANG_NAM_VAN_BAN") ??
                findFieldValueInGroups(fileItem.groups, "NGAY_BAN_HANH_AN_QD");
            const parts = parseDateParts(dateStr);
            if (fieldKey === "__date_day") return sanitizeDatePart(parts.day);
            if (fieldKey === "__date_month") return sanitizeDatePart(parts.month);
            if (fieldKey === "__date_year") return sanitizeDatePart(parts.year);
        }
        return "";
    }

    const { groupCode, fieldName } = parsed;

    if (fieldName === "NGAY" || fieldName === "THANG" || fieldName === "NAM") {
        const direct = findFieldValueInGroups(fileItem.groups, fieldName);
        if (direct !== null) {
            return sanitizeDatePart(direct);
        }

        const dateStr =
            findFieldValueInGroups(fileItem.groups, "NGAY_THANG_NAM_BAN_HANH") ??
            findFieldValueInGroups(fileItem.groups, "NGAY_THANG_NAM_VAN_BAN") ??
            findFieldValueInGroups(fileItem.groups, "NGAY_BAN_HANH_AN_QD");
        const parts = parseDateParts(dateStr);
        if (fieldName === "NGAY") return sanitizeDatePart(parts.day);
        if (fieldName === "THANG") return sanitizeDatePart(parts.month);
        if (fieldName === "NAM") return sanitizeDatePart(parts.year);
        return "";
    }

    const isDatePart = fieldName === "NGAY" || fieldName === "THANG" || fieldName === "NAM";
    const values: string[] = [];
    for (const group of fileItem.groups) {
        if (group.group_code !== groupCode && groupCode !== "TAI_LIEU_LUU_TRU") {
            continue;
        }
        for (const field of group.fields ?? []) {
            if (!fieldMatchesKey(field.name, fieldName)) {
                continue;
            }
            const formatted = formatCellValue(field.value);
            if (formatted) {
                const finalVal = isDatePart ? sanitizeDatePart(formatted) : formatted;
                if (finalVal) {
                    values.push(finalVal);
                }
            }
        }
    }

    if (values.length > 0) {
        return values.join(INSTANCE_JOIN_SEPARATOR);
    }

    for (const group of fileItem.groups) {
        for (const field of group.fields ?? []) {
            if (fieldMatchesKey(field.name, fieldName)) {
                const formatted = formatCellValue(field.value);
                if (formatted) {
                    const finalVal = isDatePart ? sanitizeDatePart(formatted) : formatted;
                    if (finalVal) {
                        values.push(finalVal);
                    }
                }
            }
        }
    }

    if (values.length > 0) {
        return values.join(INSTANCE_JOIN_SEPARATOR);
    }

    return resolveExportFieldValue(metadata, fieldKey);
}

export function resolveExportColumnValueForFile(
    metadata: DossierMetadata,
    fileItem: DossierFileItem,
    column: MetadataExportColumnConfig,
    options: { dossierIndex: number; fileIndex: number; fileCount: number },
): string {
    if (isExportSttColumn(column)) {
        return String(options.dossierIndex + 1);
    }

    const isDossierCol = isDossierColumn(column);
    const parts: string[] = [];

    for (const fieldKey of column.fieldKeys) {
        if (parts.length > 0 && !column.separator) {
            break;
        }

        let value = "";

        if (fieldKey.startsWith("__")) {
            if (fieldKey === "__stt") {
                value = String(options.dossierIndex + 1);
            } else if (fieldKey === "__file_stt") {
                value = String(options.fileIndex);
            } else if (fieldKey === "__file_count") {
                value = String(options.fileCount);
            } else if (fieldKey === "__ho_so_id") {
                value = extractBasenameFromPath(metadata.ho_so_id);
            } else if (fieldKey === "__file_path") {
                const fp =
                    fileItem.sourceDocument.file_path ??
                    fileItem.sourceDocument.file_name ??
                    "";
                value = cleanFilePath(fp);
            } else {
                value = resolveExportFieldValueForFileItem(metadata, fileItem, fieldKey);
            }
        } else if (isDossierCol) {
            value = resolveExportFieldValue(metadata, fieldKey);
        } else {
            value = resolveExportFieldValueForFileItem(metadata, fileItem, fieldKey);
        }

        if (fieldKey === "TAI_LIEU_LUU_TRU.TEP_TIN_TAI_LIEU" && value) {
            value = cleanFilePath(value);
        }

        if (value && !parts.includes(value)) {
            parts.push(value);
        }
    }

    return parts.join(column.separator ?? "");
}

export function resolveExportColumnValue(
    metadata: DossierMetadata,
    column: MetadataExportColumnConfig,
    options: { rowNumber?: number } = {},
): string {
    if (isExportSttColumn(column) && options.rowNumber != null) {
        return String(options.rowNumber);
    }

    const fileItems = extractDossierFileItems(metadata);
    const firstItem = fileItems[0] ?? {
        fileIndex: 1,
        sourceDocument: { file_name: null, file_path: null },
        groups: metadata.metadata_groups,
    };

    return resolveExportColumnValueForFile(metadata, firstItem, column, {
        dossierIndex: (options.rowNumber ?? 1) - 1,
        fileIndex: 1,
        fileCount: fileItems.length,
    });
}

export function buildUnionExportFieldCatalog(
    metadataList: DossierMetadata[],
): MetadataExportFieldCatalogItem[] {
    const seen = new Set<string>();
    const catalog: MetadataExportFieldCatalogItem[] = [];

    for (const metadata of metadataList) {
        for (const group of metadata.metadata_groups) {
            for (const field of group.fields ?? []) {
                const fieldName = normalizeFieldName(field.name);
                const key = `${group.group_code}.${fieldName}`;
                if (seen.has(key)) {
                    continue;
                }
                seen.add(key);
                catalog.push({
                    key,
                    groupCode: group.group_code,
                    groupName: group.group_name,
                    fieldName,
                    display: resolveFieldDisplayHeader(field),
                });
            }
        }
    }

    return catalog;
}

function resolveFieldDisplayHeader(field: { name: string; display: string }): string {
    const display = field.display?.trim();
    if (display) {
        const normalized = normalizeFieldDisplay(display);
        if (normalized) {
            return normalized;
        }
    }
    return normalizeFieldName(field.name);
}

export function buildDefaultExportConfig(
    metadataList: DossierMetadata[],
): MetadataExportColumnConfig[] {
    const hasTt05Structure = metadataList.some((meta) =>
        meta.metadata_groups.some(
            (g) => g.group_code === "HO_SO_LUU_TRU" || g.group_code === "TAI_LIEU_LUU_TRU",
        ),
    );

    if (hasTt05Structure) {
        return [...TT05_DEFAULT_EXPORT_COLUMNS];
    }

    const columns: MetadataExportColumnConfig[] = [createExportSttColumn()];
    const coveredKeys = new Set<string>();

    for (const metadata of metadataList) {
        for (const group of metadata.metadata_groups) {
            if (Array.isArray(group.fields)) {
                for (const field of group.fields) {
                    const norm = normalizeFieldName(field.name);
                    const canonicalKey = `${group.group_code}.${norm}`;
                    if (!coveredKeys.has(canonicalKey)) {
                        coveredKeys.add(canonicalKey);
                        columns.push({
                            header: resolveFieldDisplayHeader(field),
                            fieldKeys: [`${group.group_code}.${norm}`],
                            separator: "",
                            headerColor: group.group_code === "HO_SO_LUU_TRU" ? "8EAADB" : "A9CD90",
                        });
                    }
                }
            }

            const nestedDocs = group.documents ?? group.document;
            if (Array.isArray(nestedDocs)) {
                for (const doc of nestedDocs) {
                    if (Array.isArray(doc.fields)) {
                        for (const field of doc.fields) {
                            const norm = normalizeFieldName(field.name);
                            const canonicalKey = `${group.group_code}.${norm}`;
                            if (!coveredKeys.has(canonicalKey)) {
                                coveredKeys.add(canonicalKey);
                                columns.push({
                                    header: resolveFieldDisplayHeader(field),
                                    fieldKeys: [`${group.group_code}.${norm}`],
                                    separator: "",
                                    headerColor: "A9CD90",
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    return columns;
}

