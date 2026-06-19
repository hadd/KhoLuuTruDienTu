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

/** Parse stored JSON reject_fields string from DB. */
export function parseRejectFields(json: string | null | undefined): string[] | null {
    return parseAllowedFields(json);
}

/** Serialize reject fields array for DB storage. */
export function serializeRejectFields(rejectFields: string[] | null): string | null {
    return serializeAllowedFields(rejectFields);
}

/**
 * True when a reject field falls within a maker assignment's allowedFields scope.
 * Full-access makers (allowedFields null) cover every reject field.
 */
export function rejectFieldMatchesAssignmentScope(
    rejectField: string,
    allowedFields: string[] | null,
): boolean {
    if (allowedFields === null) return true;

    if (rejectField.endsWith(".*")) {
        const groupCode = rejectField.slice(0, -2);
        return allowedFields.some(
            (key) => key === `${groupCode}.*` || key.startsWith(`${groupCode}.`),
        );
    }

    const dotIdx = rejectField.indexOf(".");
    if (dotIdx === -1) return false;

    const groupCode = rejectField.slice(0, dotIdx);
    const fieldName = rejectField.slice(dotIdx + 1);
    return isFieldAllowed(groupCode, fieldName, buildAllowedKeySet(allowedFields));
}

/** Subset of reject fields that belong to this maker assignment. */
export function filterRejectFieldsForAssignment(
    rejectFields: string[],
    allowedFields: string[] | null,
): string[] {
    if (allowedFields === null) return [...rejectFields];
    return rejectFields.filter((field) =>
        rejectFieldMatchesAssignmentScope(field, allowedFields)
    );
}

/** Whether a completed maker assignment should reopen after a selective reject. */
export function shouldResetMakerOnReject(
    allowedFields: string[] | null,
    rejectFields: string[] | null,
): boolean {
    if (!rejectFields || rejectFields.length === 0) return true;
    return filterRejectFieldsForAssignment(rejectFields, allowedFields).length > 0;
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
    const claimedIndices = new Set<number>();

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
                claimedIndices.add(i);
                merged = true;
                break;
            }
            occurrence++;
        }

        if (!merged) {
            for (let i = 0; i < result.length; i++) {
                if (claimedIndices.has(i)) continue;
                if (normalizeFieldName(result[i]!.name) !== partialCanonical) continue;
                result[i] = {
                    ...partialField,
                    name: result[i]!.name,
                };
                claimedIndices.add(i);
                merged = true;
                break;
            }
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
