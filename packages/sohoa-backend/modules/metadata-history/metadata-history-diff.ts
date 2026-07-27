import type { DossierMetadata } from "../../libs/metadata-types.ts";
import { expandTaiLieuDocuments } from "../../libs/metadata-normalize.ts";
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
    const expanded = expandTaiLieuDocuments(meta);

    if (meta.ho_so_id !== undefined) {
        map.set("@root.ho_so_id", normalizeFieldValue(meta.ho_so_id));
    }
    if (meta.trang_thai_ho_so !== undefined) {
        map.set("@root.trang_thai_ho_so", normalizeFieldValue(meta.trang_thai_ho_so));
    }

    const record = expanded as DossierMetadata & Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
        if (key === "metadata_groups" || key === "ho_so_id" || key === "trang_thai_ho_so") {
            continue;
        }
        if (value !== null && typeof value === "object") {
            continue;
        }
        map.set(`@root.${key}`, normalizeFieldValue(value));
    }

    for (const group of expanded.metadata_groups) {
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
