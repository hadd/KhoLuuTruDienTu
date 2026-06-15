import type { DossierMetadata } from "../../libs/metadata-types.ts";
import type { FieldChanges } from "./metadata-history-policy.ts";

export function normalizeFieldValue(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === "string") {
        return value;
    }
    return JSON.stringify(value);
}

export function flattenFields(meta: DossierMetadata): Map<string, string | null> {
    const map = new Map<string, string | null>();
    for (const group of meta.metadata_groups) {
        for (const field of group.fields) {
            map.set(`${group.group_code}.${field.name}`, normalizeFieldValue(field.value));
        }
    }
    return map;
}

export function computeFieldDiff(
    oldMeta: DossierMetadata,
    newMeta: DossierMetadata,
): FieldChanges | null {
    const oldMap = flattenFields(oldMeta);
    const newMap = flattenFields(newMeta);
    const changes: FieldChanges = {};

    const allKeys = new Set([...oldMap.keys(), ...newMap.keys()]);
    for (const key of allKeys) {
        const oldVal = oldMap.get(key) ?? null;
        const newVal = newMap.get(key) ?? null;
        if (oldVal !== newVal) {
            changes[key] = { old: oldVal, new: newVal };
        }
    }

    return Object.keys(changes).length > 0 ? changes : null;
}
