import {
    expandPatternToCatalogKeys,
    parseFieldCatalog,
    parseFieldKeys,
    type MetadataFieldCatalogEntry,
} from "./metadata-template.ts";
import { canonicalizeMetadataFields } from "./metadata-field-filter.ts";
import type { DossierMetadata } from "./metadata-types.ts";

export { canonicalizeMetadataFields };

export interface PermissionSlotInput {
    slotCode: string;
    slotName: string;
    fieldKeys: string[];
}

export function expandSlotFieldKeys(
    slot: { fieldKeys: string[] },
    catalogKeys: string[],
): string[] {
    const expanded = new Set<string>();
    for (const pattern of slot.fieldKeys) {
        for (const key of expandPatternToCatalogKeys(pattern, catalogKeys)) {
            expanded.add(key);
        }
    }
    return [...expanded];
}

export function validateSlotCoverage(
    catalog: MetadataFieldCatalogEntry[] | string,
    slots: PermissionSlotInput[],
): {
    valid: boolean;
    uncoveredKeys: string[];
    overlappingKeys: { key: string; slotCodes: string[] }[];
    invalidPatterns: string[];
} {
    const entries = typeof catalog === "string" ? parseFieldCatalog(catalog) : catalog;
    const catalogKeys = entries.map((e) => e.key);
    const keyToSlots = new Map<string, string[]>();
    const invalidPatterns: string[] = [];

    for (const slot of slots) {
        for (const pattern of slot.fieldKeys) {
            const keys = expandPatternToCatalogKeys(pattern, catalogKeys);
            if (keys.length === 0) {
                invalidPatterns.push(`${slot.slotCode}:${pattern}`);
                continue;
            }
            for (const key of keys) {
                const existing = keyToSlots.get(key) ?? [];
                existing.push(slot.slotCode);
                keyToSlots.set(key, existing);
            }
        }
    }

    const uncoveredKeys = catalogKeys.filter((key) => !keyToSlots.has(key));
    const overlappingKeys = [...keyToSlots.entries()]
        .filter(([, slotCodes]) => slotCodes.length > 1)
        .map(([key, slotCodes]) => ({ key, slotCodes: [...new Set(slotCodes)] }));

    return {
        valid:
            uncoveredKeys.length === 0
            && overlappingKeys.length === 0
            && invalidPatterns.length === 0,
        uncoveredKeys,
        overlappingKeys,
        invalidPatterns,
    };
}

export function validateGroupSlotAssignments(
    slots: Array<{ slotCode: string }>,
    assignments: Array<{ slotCode: string; editorIds: string[] }>,
): {
    valid: boolean;
    duplicateEditors: string[];
    uncoveredSlots: string[];
    emptySlots: string[];
} {
    const slotCodes = new Set(slots.map((s) => s.slotCode));
    const editorToSlot = new Map<string, string>();
    const duplicateEditors: string[] = [];
    const assignedSlots = new Set<string>();

    for (const item of assignments) {
        if (!slotCodes.has(item.slotCode)) {
            continue;
        }
        if (item.editorIds.length === 0) {
            continue;
        }
        assignedSlots.add(item.slotCode);
        for (const editorId of item.editorIds) {
            if (editorToSlot.has(editorId)) {
                duplicateEditors.push(editorId);
            } else {
                editorToSlot.set(editorId, item.slotCode);
            }
        }
    }

    const uncoveredSlots = [...slotCodes].filter((code) => !assignedSlots.has(code));
    const emptySlots = assignments
        .filter((a) => slotCodes.has(a.slotCode) && a.editorIds.length === 0)
        .map((a) => a.slotCode);

    return {
        valid: duplicateEditors.length === 0 && uncoveredSlots.length === 0,
        duplicateEditors: [...new Set(duplicateEditors)],
        uncoveredSlots,
        emptySlots,
    };
}

export function buildSlotFieldKeysMap(
    slots: Array<{ slotCode: string; fieldKeys: string }>,
    catalogJson: string,
): Map<string, string[]> {
    const catalogKeys = parseFieldCatalog(catalogJson).map((e) => e.key);
    const map = new Map<string, string[]>();
    for (const slot of slots) {
        const keys = parseFieldKeys(slot.fieldKeys);
        map.set(slot.slotCode, expandSlotFieldKeys({ fieldKeys: keys }, catalogKeys));
    }
    return map;
}

export function resolveAllowedFieldsForSlot(
    slotCode: string | null | undefined,
    slotFieldKeysMap: Map<string, string[]>,
): string[] | null {
    if (!slotCode) {
        return null;
    }
    const keys = slotFieldKeysMap.get(slotCode);
    return keys && keys.length > 0 ? keys : null;
}
