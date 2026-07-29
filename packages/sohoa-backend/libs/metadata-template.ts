import {
    findMetadataFieldValue,
    parseDossierMetadata,
    resolveCatalogGroupAliasCodes,
    resolveMetadataGroupCatalogCode,
    TEN_LOAI_TAI_LIEU_FIELD,
} from "./metadata-normalize.ts";
import type { DossierMetadata, MetadataGroup } from "./metadata-types.ts";
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

function resolveCatalogGroup(
    group: MetadataGroup,
): { groupCode: string; groupName: string } {
    const groupCode = resolveMetadataGroupCatalogCode(group);
    if (groupCode !== group.group_code) {
        const displayName = findMetadataFieldValue(
            group.fields,
            TEN_LOAI_TAI_LIEU_FIELD,
        );
        return {
            groupCode,
            groupName: displayName || group.group_name?.trim() || groupCode,
        };
    }

    return {
        groupCode,
        groupName: group.group_name?.trim() || groupCode,
    };
}

/**
 * Build deduplicated field catalog from OCR metadata JSON.
 * Supports TT05 nested `documents[]` under TAI_LIEU_LUU_TRU.
 */
export function extractFieldCatalog(metadata: DossierMetadata): MetadataFieldCatalogEntry[] {
    const normalized = parseDossierMetadata(metadata);
    if (!normalized) return [];

    const seen = new Set<string>();
    const catalog: MetadataFieldCatalogEntry[] = [];

    for (const group of normalized.metadata_groups) {
        const fields = Array.isArray(group.fields) ? group.fields : [];
        const { groupCode, groupName } = resolveCatalogGroup(group);

        for (const field of fields) {
            const fieldName = normalizeFieldName(field.name);
            const key = `${groupCode}.${fieldName}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            catalog.push({
                key,
                groupCode,
                groupName,
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
        const groupCodes = resolveCatalogGroupAliasCodes(groupCode);
        return catalogKeys.filter((key) =>
            groupCodes.some((code) => key.startsWith(`${code}.`))
        );
    }

    const normalizedField = normalizeFieldName(fieldPart);
    for (const code of resolveCatalogGroupAliasCodes(groupCode)) {
        const normalized = `${code}.${normalizedField}`;
        if (catalogKeys.includes(normalized)) {
            return [normalized];
        }
    }
    if (catalogKeys.includes(pattern)) {
        return [pattern];
    }
    return [];
}
