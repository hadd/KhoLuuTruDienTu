import { normalizeFieldDisplay, normalizeFieldName } from "./metadata-field-filter.ts";
import type { DossierMetadata } from "./metadata-types.ts";
import type { MetadataExportColumnConfig, MetadataExportFieldCatalogItem } from "./metadata-export-types.ts";
import {
    createExportSttColumn,
    isExportSttColumn,
} from "./metadata-export-types.ts";

const INSTANCE_JOIN_SEPARATOR = "\n";

function formatCellValue(value: string | null | undefined): string {
    if (value === null || value === undefined) {
        return "";
    }
    return String(value);
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

/**
 * Resolve all instance values for a field key. Multiple instances are joined with newlines.
 */
export function resolveExportFieldValue(
    metadata: DossierMetadata,
    fieldKey: string,
): string {
    const parsed = parseFieldKey(fieldKey);
    if (!parsed) {
        return "";
    }

    const values: string[] = [];
    for (const group of metadata.metadata_groups) {
        if (group.group_code !== parsed.groupCode) {
            continue;
        }
        for (const field of group.fields) {
            if (!fieldMatchesKey(field.name, parsed.fieldName)) {
                continue;
            }
            const formatted = formatCellValue(field.value);
            if (formatted) {
                values.push(formatted);
            }
        }
    }

    return values.join(INSTANCE_JOIN_SEPARATOR);
}

export function resolveExportColumnValue(
    metadata: DossierMetadata,
    column: MetadataExportColumnConfig,
    options: { rowNumber?: number } = {},
): string {
    if (isExportSttColumn(column) && options.rowNumber != null) {
        return String(options.rowNumber);
    }

    const parts: string[] = [];
    for (const fieldKey of column.fieldKeys) {
        const value = resolveExportFieldValue(metadata, fieldKey);
        if (value) {
            parts.push(value);
        }
    }
    return parts.join(column.separator ?? "");
}

export function buildUnionExportFieldCatalog(
    metadataList: DossierMetadata[],
): MetadataExportFieldCatalogItem[] {
    const seen = new Set<string>();
    const catalog: MetadataExportFieldCatalogItem[] = [];

    for (const metadata of metadataList) {
        for (const group of metadata.metadata_groups) {
            for (const field of group.fields) {
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

/**
 * Default export: STT column first, then one column per unique field key (header = field display).
 */
export function buildDefaultExportConfig(
    metadataList: DossierMetadata[],
): MetadataExportColumnConfig[] {
    const seen = new Set<string>();
    const columns: MetadataExportColumnConfig[] = [createExportSttColumn()];

    for (const metadata of metadataList) {
        for (const group of metadata.metadata_groups) {
            for (const field of group.fields) {
                const fieldName = normalizeFieldName(field.name);
                const key = `${group.group_code}.${fieldName}`;
                if (seen.has(key)) {
                    continue;
                }
                seen.add(key);
                columns.push({
                    header: resolveFieldDisplayHeader(field),
                    fieldKeys: [key],
                    separator: "",
                });
            }
        }
    }

    return columns;
}
