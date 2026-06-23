import type { WorkerRole } from "../../db/schemas/workflow-constants.ts";

function normalizeStorageKey(key: string): string {
    return key.replace(/^\/+/, "").replace(/\\/g, "/");
}

export function buildCuratedMetadataUpdateKey(
    ocrMetadataKey: string,
    role: WorkerRole,
    attemptNumber = 1,
): string {
    const normalized = normalizeStorageKey(ocrMetadataKey);

    let saveKeyBase: string;
    if (normalized.includes("Curated/metadata_update/")) {
        saveKeyBase = normalized;
    } else if (normalized.includes("Curated/metadata/")) {
        saveKeyBase = normalized.replace(/Curated\/metadata\//, "Curated/metadata_update/");
    } else if (/(^|\/)metadata_update\//.test(normalized)) {
        saveKeyBase = normalized.replace(/(^|\/)metadata_update\//, "$1Curated/metadata_update/");
    } else {
        saveKeyBase = normalized.replace(/(^|\/)metadata\//, "$1Curated/metadata_update/");
    }

    const withExtension = saveKeyBase.endsWith(".json") ? saveKeyBase : `${saveKeyBase}.json`;
    const withoutExt = withExtension.replace(/\.json$/i, "");
    const rolePattern = new RegExp(`_${role}(_A\\d+)?$`, "i");
    const base = withoutExt.replace(rolePattern, "");
    if (attemptNumber <= 1) {
        return `${base}_${role}.json`;
    }
    return `${base}_${role}_A${attemptNumber}.json`;
}

/** Merged MAKER entry — new file alongside OCR output, never overwrites the OCR key. */
export function buildEditorMergedMetadataKey(
    ocrMetadataKey: string,
    attemptNumber = 1,
): string {
    const normalized = normalizeStorageKey(ocrMetadataKey);
    const withExtension = normalized.endsWith(".json") ? normalized : `${normalized}.json`;
    const withoutExt = withExtension.replace(/\.json$/i, "");
    const base = withoutExt.replace(/_EDITOR(_A\d+)?$/i, "");
    if (attemptNumber <= 1) {
        return `${base}_EDITOR.json`;
    }
    return `${base}_EDITOR_A${attemptNumber}.json`;
}

/** Chuyển metadata key thành bản nháp: `ho_so_EDITOR.json` → `ho_so_EDITOR_DRAFT.json`. */
export function buildDraftMetadataKey(baseKey: string): string {
    const normalized = normalizeStorageKey(baseKey);
    const withExtension = normalized.endsWith(".json") ? normalized : `${normalized}.json`;
    const withoutExt = withExtension.replace(/\.json$/i, "");
    const base = withoutExt.replace(/_DRAFT$/i, "");
    return `${base}_DRAFT.json`;
}

export function isDraftMetadataKey(key: string): boolean {
    return /_DRAFT\.json$/i.test(normalizeStorageKey(key));
}
