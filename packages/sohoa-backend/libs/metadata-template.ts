import type { DossierMetadata } from "./metadata-types.ts";
import { normalizeFieldDisplay, normalizeFieldName } from "./metadata-field-filter.ts";

export interface MetadataFieldCatalogEntry {
    key: string;
    groupCode: string;
    groupName?: string;
    fieldName: string;
    display: string;
}

export function parseFieldCatalog(json: string): MetadataFieldCatalogEntry[] {
    const parsed = JSON.parse(json) as MetadataFieldCatalogEntry[];
    if (!Array.isArray(parsed)) {
        throw new Error("Invalid field catalog JSON");
    }
    return parsed;
}

export function serializeFieldCatalog(catalog: MetadataFieldCatalogEntry[]): string {
    return JSON.stringify(catalog);
}

/**
 * Build deduplicated field catalog from OCR metadata JSON.
 */
export function extractFieldCatalog(metadata: DossierMetadata): MetadataFieldCatalogEntry[] {
    const seen = new Set<string>();
    const catalog: MetadataFieldCatalogEntry[] = [];

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
                display: normalizeFieldDisplay(field.display?.trim() || "") || fieldName,
            });
        }
    }

    return catalog;
}

export function enrichFieldCatalogWithGroupNames(
    catalog: MetadataFieldCatalogEntry[],
    metadata: DossierMetadata,
    catalogNameByCode?: Map<string, string>,
): MetadataFieldCatalogEntry[] {
    const groupNameByCode = new Map(
        metadata.metadata_groups.map((group) => [group.group_code, group.group_name]),
    );

    return catalog.map((entry) => ({
        ...entry,
        groupName:
            catalogNameByCode?.get(entry.groupCode) ??
            entry.groupName ??
            groupNameByCode.get(entry.groupCode) ??
            "",
    }));
}

export function parseFieldKeys(json: string): string[] {
    const parsed = JSON.parse(json) as string[];
    if (!Array.isArray(parsed)) {
        throw new Error("Invalid field keys JSON");
    }
    return parsed;
}

export function serializeFieldKeys(keys: string[]): string {
    return JSON.stringify(keys);
}

/**
 * Expand a pattern against a template catalog (exact key or GROUP.* wildcard).
 */
export function expandPatternToCatalogKeys(
    pattern: string,
    catalogKeys: string[],
): string[] {
    const dotIndex = pattern.indexOf(".");
    if (dotIndex < 0) {
        return [];
    }

    const groupCode = pattern.slice(0, dotIndex);
    const fieldPart = pattern.slice(dotIndex + 1);

    if (fieldPart === "*") {
        return catalogKeys.filter((key) => key.startsWith(`${groupCode}.`));
    }

    const normalized = `${groupCode}.${normalizeFieldName(fieldPart)}`;
    if (catalogKeys.includes(normalized)) {
        return [normalized];
    }
    if (catalogKeys.includes(pattern)) {
        return [pattern];
    }
    return [];
}
