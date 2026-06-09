import type { DossierMetadata, MetadataGroup, MetadataField } from "./metadata-types.ts";
import {
    ALL_GROUP_CODES,
    ALL_METADATA_FIELD_KEYS,
    METADATA_SCHEMA,
} from "./metadata-schema.ts";

/**
 * Normalize dynamic field names by replacing _<digits>_ with _N_.
 * Examples:
 *   "_1_HO_VA_TEN"                          → "_N_HO_VA_TEN"
 *   "SO_PHAI_THU_CHU_DONG_1_TIEU_CHI"       → "SO_PHAI_THU_CHU_DONG_N_TIEU_CHI"
 *   "NGHIA_VU_1_NOI_DUNG_NGHIA_VU"          → "NGHIA_VU_N_NOI_DUNG_NGHIA_VU"
 *   "SO_BAN_AN"                              → "SO_BAN_AN"  (unchanged)
 */
export function normalizeFieldName(fieldName: string): string {
    return fieldName.replace(/_\d+_/g, "_N_");
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

/**
 * Build the set of normalized keys that are permitted.
 * Handles wildcard `GROUP.*` and explicit `GROUP.FIELD` patterns.
 */
function buildAllowedKeySet(allowedFields: string[]): Set<string> {
    return new Set(allowedFields);
}

/**
 * Check whether a single field in a group is allowed.
 * Matching order:
 *   1. "GROUP_CODE.*"                           → wildcard, allows all fields in group
 *   2. "GROUP_CODE.normalizedFieldName"         → normalized pattern match
 *   3. "GROUP_CODE.exactFieldName"              → exact match (for non-dynamic fields)
 */
function isFieldAllowed(
    groupCode: string,
    fieldName: string,
    allowedSet: Set<string>,
): boolean {
    if (allowedSet.has(`${groupCode}.*`)) return true;
    const normalized = normalizeFieldName(fieldName);
    if (allowedSet.has(`${groupCode}.${normalized}`)) return true;
    if (allowedSet.has(`${groupCode}.${fieldName}`)) return true;
    return false;
}

/**
 * Filter a DossierMetadata object to only include fields the caller is permitted to see.
 * Passing null for allowedFields means full access (returns metadata unmodified).
 * Groups with no allowed fields are omitted entirely.
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

    return {
        ...metadata,
        metadata_groups: filteredGroups,
    };
}

/**
 * Validate that an incoming metadata write only touches fields the actor is allowed to write.
 * Returns { allowed: true } when validation passes, or { allowed: false, violations } otherwise.
 * Passing null for allowedFields means full access (always passes).
 */
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

/**
 * Expand one allowedFields pattern into concrete schema field keys.
 * "GROUP.*" → all fields in that group; "GROUP.FIELD" → matching schema field(s).
 */
function expandPatternToSchemaKeys(pattern: string): string[] {
    const dotIndex = pattern.indexOf(".");
    if (dotIndex < 0) {
        return [];
    }

    const groupCode = pattern.slice(0, dotIndex);
    const fieldPart = pattern.slice(dotIndex + 1);
    const group = METADATA_SCHEMA.find((g) => g.groupCode === groupCode);
    if (!group) {
        return [];
    }

    if (fieldPart === "*") {
        return group.fields.map((field) => `${groupCode}.${field.name}`);
    }

    const normalizedPart = normalizeFieldName(fieldPart);
    return group.fields
        .filter((field) => field.name === fieldPart || field.name === normalizedPart)
        .map((field) => `${groupCode}.${field.name}`);
}

/**
 * Validate field assignment templates for a group of editors.
 * Rules (field-level, using METADATA_SCHEMA as reference):
 *   - Every schema field key must be assigned to exactly one editor.
 *   - No field key may be claimed by more than one editor.
 *   - Multiple editors may share a group when they own disjoint fields
 *     (e.g. NHAN_UY_THAC_THA.SO_THONG_BAO vs NHAN_UY_THAC_THA.NGAY_THONG_BAO).
 *   - Wildcard "GROUP.*" assigns the entire group and cannot overlap other patterns in that group.
 */
export function validateFieldAssignmentCoverage(
    assignments: { editorId: string; allowedFields: string[] }[],
): {
    valid: boolean;
    uncoveredFields: string[];
    overlappingFields: { fieldKey: string; editorIds: string[] }[];
    uncoveredGroups: string[];
    overlappingGroups: { groupCode: string; editorIds: string[] }[];
    invalidPatterns: string[];
} {
    const fieldToEditors = new Map<string, string[]>();
    const invalidPatterns: string[] = [];

    for (const assignment of assignments) {
        for (const pattern of assignment.allowedFields) {
            const keys = expandPatternToSchemaKeys(pattern);
            if (keys.length === 0) {
                invalidPatterns.push(pattern);
                continue;
            }

            for (const key of keys) {
                const existing = fieldToEditors.get(key) ?? [];
                existing.push(assignment.editorId);
                fieldToEditors.set(key, existing);
            }
        }
    }

    const uncoveredFields = ALL_METADATA_FIELD_KEYS.filter((key) => !fieldToEditors.has(key));

    const overlappingFields = [...fieldToEditors.entries()]
        .filter(([, editors]) => editors.length > 1)
        .map(([fieldKey, editorIds]) => ({
            fieldKey,
            editorIds: [...new Set(editorIds)],
        }));

    const coveredGroups = new Set(
        [...fieldToEditors.keys()].map((key) => key.split(".")[0]!),
    );
    const uncoveredGroups = ALL_GROUP_CODES.filter((code) => !coveredGroups.has(code));

    // Wildcard on a group still exclusive: flag when GROUP.* coexists with other editors on same group.
    const wildcardGroupEditors = new Map<string, string[]>();
    for (const assignment of assignments) {
        for (const pattern of assignment.allowedFields) {
            if (!pattern.endsWith(".*")) {
                continue;
            }
            const groupCode = pattern.slice(0, pattern.length - 2);
            const existing = wildcardGroupEditors.get(groupCode) ?? [];
            existing.push(assignment.editorId);
            wildcardGroupEditors.set(groupCode, existing);
        }
    }

    const overlappingGroups: { groupCode: string; editorIds: string[] }[] = [];
    for (const [groupCode, wildcardEditors] of wildcardGroupEditors) {
        const groupFieldKeys = ALL_METADATA_FIELD_KEYS.filter((key) =>
            key.startsWith(`${groupCode}.`)
        );
        const editorsInGroup = new Set<string>(wildcardEditors);
        for (const fieldKey of groupFieldKeys) {
            for (const editorId of fieldToEditors.get(fieldKey) ?? []) {
                editorsInGroup.add(editorId);
            }
        }
        if (editorsInGroup.size > 1) {
            overlappingGroups.push({
                groupCode,
                editorIds: [...editorsInGroup],
            });
        }
    }

    return {
        valid:
            uncoveredFields.length === 0
            && overlappingFields.length === 0
            && invalidPatterns.length === 0
            && overlappingGroups.length === 0,
        uncoveredFields,
        overlappingFields,
        uncoveredGroups,
        overlappingGroups,
        invalidPatterns,
    };
}

/**
 * Merge partial metadata objects from multiple MAKERs into a base metadata.
 * For each field in each partial, the partial value overwrites the base value.
 * Groups and fields not in the base are added. Groups not present in any partial
 * remain unchanged from the base.
 */
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

            const fieldMap = new Map<string, MetadataField>(
                baseGroup.fields.map((f) => [f.name, f]),
            );

            for (const partialField of partialGroup.fields) {
                fieldMap.set(partialField.name, { ...partialField });
            }

            baseGroup.fields = [...fieldMap.values()];
        }
    }

    return {
        ...base,
        metadata_groups: [...groupMap.values()],
    };
}
