import {
    parseDossierMetadata,
    resolveCatalogGroupAliasCodes,
    resolveMetadataGroupCatalogCode,
    TAI_LIEU_LUU_TRU_GROUP_CODE,
    TEN_LOAI_TAI_LIEU_FIELD,
} from "./metadata-normalize.ts";
import type { DossierMetadata, MetadataGroup, MetadataField } from "./metadata-types.ts";

/**
 * Strip numeric instance segments from OCR field names.
 * Examples:
 *   "_1_HO_VA_TEN"                    → "HO_VA_TEN"
 *   "SO_PHAI_THU_CHU_DONG_1_TIEU_CHI" → "SO_PHAI_THU_CHU_DONG_TIEU_CHI"
 *   "SO_CCCD_1"                       → "SO_CCCD"
 */
export function normalizeFieldName(fieldName: string): string {
    return fieldName
        .replace(/_\d+_/g, "_")
        .replace(/_\d+$/, "")
        .replace(/^\d+_/, "")
        .replace(/^_+/, "")
        .replace(/_+/g, "_");
}

/**
 * Strip trailing instance index from human-readable labels.
 * Examples: "Số CCCD 1" → "Số CCCD", "Họ và tên 2" → "Họ và tên"
 */
export function normalizeFieldDisplay(display: string): string {
    return display
        .trim()
        .replace(/\s+\d+\s*$/, "")
        .trim();
}

/** Chuẩn hóa key GROUP.FIELD từ diff metadata (OCR name → canonical). */
export function canonicalizeMetadataFieldKey(fieldKey: string): string {
    if (fieldKey.endsWith(".*")) {
        return fieldKey;
    }
    const dotIdx = fieldKey.indexOf(".");
    if (dotIdx === -1) {
        return fieldKey;
    }
    const groupCode = fieldKey.slice(0, dotIdx);
    const fieldName = fieldKey.slice(dotIdx + 1);
    return `${groupCode}.${normalizeFieldName(fieldName)}`;
}

export function canonicalizeMetadataFieldKeys(fieldKeys: string[]): string[] {
    return [...new Set(fieldKeys.map(canonicalizeMetadataFieldKey))];
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
    for (const code of resolveCatalogGroupAliasCodes(groupCode)) {
        if (allowedSet.has(`${code}.*`)) return true;
        const normalized = normalizeFieldName(fieldName);
        if (allowedSet.has(`${code}.${normalized}`)) return true;
        if (allowedSet.has(`${code}.${fieldName}`)) return true;
        if (allowedSet.has(`${code}._N_${normalized}`)) return true;
    }
    return false;
}

/** Match catalog group code and legacy TT05 `TAI_LIEU_LUU_TRU.*` slot patterns. */
function isMetadataFieldAllowedForGroup(
    group: MetadataGroup,
    catalogGroupCode: string,
    fieldName: string,
    allowedSet: Set<string>,
): boolean {
    if (isFieldAllowed(catalogGroupCode, fieldName, allowedSet)) return true;
    if (
        group.group_code === TAI_LIEU_LUU_TRU_GROUP_CODE &&
        catalogGroupCode !== TAI_LIEU_LUU_TRU_GROUP_CODE
    ) {
        return isFieldAllowed(TAI_LIEU_LUU_TRU_GROUP_CODE, fieldName, allowedSet);
    }
    return false;
}

function groupCodeMatchesAllowedPatterns(
    groupCode: string,
    allowedSet: Set<string>,
): boolean {
    for (const code of resolveCatalogGroupAliasCodes(groupCode)) {
        if (allowedSet.has(`${code}.*`)) return true;
        for (const key of allowedSet) {
            if (key.startsWith(`${code}.`)) return true;
        }
    }
    return false;
}

function isTaiLieuDocumentGroupAllowed(
    catalogGroupCode: string,
    allowedSet: Set<string>,
): boolean {
    if (groupCodeMatchesAllowedPatterns(catalogGroupCode, allowedSet)) {
        return true;
    }
    return groupCodeMatchesAllowedPatterns(TAI_LIEU_LUU_TRU_GROUP_CODE, allowedSet);
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

    const normalized = parseDossierMetadata(metadata) ?? metadata;
    const allowedSet = buildAllowedKeySet(allowedFields);
    const filteredGroups: MetadataGroup[] = [];

    for (const group of normalized.metadata_groups) {
        const fields = Array.isArray(group.fields) ? group.fields : [];
        const catalogGroupCode = resolveMetadataGroupCatalogCode(group);

        if (group.group_code === TAI_LIEU_LUU_TRU_GROUP_CODE) {
            if (!isTaiLieuDocumentGroupAllowed(catalogGroupCode, allowedSet)) {
                continue;
            }
        } else if (!groupCodeMatchesAllowedPatterns(group.group_code, allowedSet)) {
            continue;
        }

        const allowedFields_forGroup = fields.filter((field) =>
            isMetadataFieldAllowedForGroup(
                group,
                catalogGroupCode,
                field.name,
                allowedSet,
            )
        );

        if (group.group_code === TAI_LIEU_LUU_TRU_GROUP_CODE) {
            const typeField = fields.find(
                (field) =>
                    field.name.trim().toUpperCase() === TEN_LOAI_TAI_LIEU_FIELD,
            );
            if (
                typeField &&
                allowedFields_forGroup.length > 0 &&
                !allowedFields_forGroup.some(
                    (field) =>
                        field.name.trim().toUpperCase() === TEN_LOAI_TAI_LIEU_FIELD,
                )
            ) {
                allowedFields_forGroup.unshift(typeField);
            }
        }

        if (allowedFields_forGroup.length > 0) {
            filteredGroups.push({
                ...group,
                fields: allowedFields_forGroup,
            });
        }
    }

    const result = canonicalizeMetadataFields({
        ...normalized,
        metadata_groups: filteredGroups,
    });

    return result;
}

export function validateWritePermission(
    incomingMetadata: DossierMetadata,
    allowedFields: string[] | null,
): { allowed: boolean; violations: string[] } {
    if (!allowedFields) return { allowed: true, violations: [] };

    const normalized = parseDossierMetadata(incomingMetadata) ?? incomingMetadata;
    const allowedSet = buildAllowedKeySet(allowedFields);
    const violations: string[] = [];

    for (const group of normalized.metadata_groups) {
        const fields = Array.isArray(group.fields) ? group.fields : [];
        const catalogGroupCode = resolveMetadataGroupCatalogCode(group);
        for (const field of fields) {
            if (
                !isMetadataFieldAllowedForGroup(
                    group,
                    catalogGroupCode,
                    field.name,
                    allowedSet,
                )
            ) {
                violations.push(`${catalogGroupCode}.${field.name}`);
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
