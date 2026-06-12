import type { DossierMetadata, MetadataGroup, MetadataField } from "./metadata-types.ts";

/**
 * Strip numeric instance segments from OCR field names.
 * Examples:
 *   "_1_HO_VA_TEN"                    → "HO_VA_TEN"
 *   "SO_PHAI_THU_CHU_DONG_1_TIEU_CHI" → "SO_PHAI_THU_CHU_DONG_TIEU_CHI"
 */
export function normalizeFieldName(fieldName: string): string {
    return fieldName
        .replace(/_\d+_/g, "_")
        .replace(/^_+/, "")
        .replace(/_+/g, "_");
}

/**
 * Map metadata fields to canonical names for API responses (keeps array length / instances).
 */
export function canonicalizeMetadataFields(metadata: DossierMetadata): DossierMetadata {
    return {
        ...metadata,
        metadata_groups: metadata.metadata_groups.map((group) => ({
            ...group,
            fields: group.fields.map((field) => ({
                ...field,
                name: normalizeFieldName(field.name),
            })),
        })),
    };
}

/**
 * Parse stored JSON allowed_fields string from DB.
 * Returns null when field access is unrestricted (full access).
 */
export function parseAllowedFields(json: string | null | undefined): string[] | null {
    if (!json) return null;
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed as string[] : null;
    } catch {
        return null;
    }
}

/**
 * Serialize allowed fields array for DB storage.
 * Returns null when allowedFields is null/empty (full access).
 */
export function serializeAllowedFields(allowedFields: string[] | null): string | null {
    if (!allowedFields || allowedFields.length === 0) return null;
    return JSON.stringify(allowedFields);
}

function buildAllowedKeySet(allowedFields: string[]): Set<string> {
    return new Set(allowedFields);
}

function isFieldAllowed(
    groupCode: string,
    fieldName: string,
    allowedSet: Set<string>,
): boolean {
    if (allowedSet.has(`${groupCode}.*`)) return true;
    const normalized = normalizeFieldName(fieldName);
    if (allowedSet.has(`${groupCode}.${normalized}`)) return true;
    if (allowedSet.has(`${groupCode}.${fieldName}`)) return true;
    // Legacy patterns using _N_ placeholder
    if (allowedSet.has(`${groupCode}._N_${normalized}`)) return true;
    return false;
}

/**
 * Filter a DossierMetadata object to only include fields the caller is permitted to see.
 * Passing null for allowedFields means full access (returns metadata unmodified).
 */
export function filterMetadataByAllowedFields(
    metadata: DossierMetadata,
    allowedFields: string[] | null,
): DossierMetadata {
    if (!allowedFields) return metadata;

    const allowedSet = buildAllowedKeySet(allowedFields);
    const filteredGroups: MetadataGroup[] = [];

    for (const group of metadata.metadata_groups) {
        const allowedFields_forGroup: MetadataField[] = group.fields.filter((field) =>
            isFieldAllowed(group.group_code, field.name, allowedSet)
        );

        if (allowedFields_forGroup.length > 0) {
            filteredGroups.push({
                ...group,
                fields: allowedFields_forGroup,
            });
        }
    }

    return canonicalizeMetadataFields({
        ...metadata,
        metadata_groups: filteredGroups,
    });
}

export function validateWritePermission(
    incomingMetadata: DossierMetadata,
    allowedFields: string[] | null,
): { allowed: boolean; violations: string[] } {
    if (!allowedFields) return { allowed: true, violations: [] };

    const allowedSet = buildAllowedKeySet(allowedFields);
    const violations: string[] = [];

    for (const group of incomingMetadata.metadata_groups) {
        for (const field of group.fields) {
            if (!isFieldAllowed(group.group_code, field.name, allowedSet)) {
                violations.push(`${group.group_code}.${field.name}`);
            }
        }
    }

    return { allowed: violations.length === 0, violations };
}

function mergeGroupFieldsByCanonicalIndex(
    baseFields: MetadataField[],
    partialFields: MetadataField[],
): MetadataField[] {
    const result = baseFields.map((field) => ({ ...field }));

    for (let partialIndex = 0; partialIndex < partialFields.length; partialIndex++) {
        const partialField = partialFields[partialIndex]!;
        const partialCanonical = normalizeFieldName(partialField.name);
        let occurrence = 0;
        let merged = false;

        for (let i = 0; i < result.length; i++) {
            if (normalizeFieldName(result[i]!.name) !== partialCanonical) {
                continue;
            }
            if (occurrence === partialIndex) {
                result[i] = {
                    ...partialField,
                    name: result[i]!.name,
                };
                merged = true;
                break;
            }
            occurrence++;
        }

        if (!merged) {
            result.push({ ...partialField });
        }
    }

    return result;
}

export function mergePartialMetadata(
    base: DossierMetadata,
    partials: DossierMetadata[],
): DossierMetadata {
    const groupMap = new Map<string, MetadataGroup>();

    for (const group of base.metadata_groups) {
        groupMap.set(group.group_code, { ...group, fields: [...group.fields] });
    }

    for (const partial of partials) {
        for (const partialGroup of partial.metadata_groups) {
            const baseGroup = groupMap.get(partialGroup.group_code);

            if (!baseGroup) {
                groupMap.set(partialGroup.group_code, {
                    ...partialGroup,
                    fields: [...partialGroup.fields],
                });
                continue;
            }

            baseGroup.fields = mergeGroupFieldsByCanonicalIndex(
                baseGroup.fields,
                partialGroup.fields,
            );
        }
    }

    return {
        ...base,
        metadata_groups: [...groupMap.values()],
    };
}
