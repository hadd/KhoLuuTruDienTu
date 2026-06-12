import * as path from "node:path";
import { env } from "../../env.ts";

const DOC_JSON_PREFIX = "doc_json";
export const PROCESSED_STORAGE_PREFIX = "processed";

export function normalizeStorageKey(key: string): string {
    return key.replace(/^\/+/, "").replace(/\\/g, "/");
}

export function storageDirname(filePath: string): string {
    const dir = path.posix.dirname(filePath);
    if (dir === "." || dir === "") {
        return "";
    }
    return dir;
}

export function storageBasename(filePath: string): string {
    return path.posix.basename(filePath);
}

export function splitFolderSegments(folderPath: string): string[] {
    const parts = folderPath.split("/").filter(Boolean);
    const segments: string[] = [];
    for (let i = 0; i < parts.length; i++) {
        segments.push(parts.slice(0, i + 1).join("/"));
    }
    return segments;
}

export function folderNameFromPath(folderPath: string): string {
    return storageBasename(folderPath);
}

function resolveRawStoragePrefix(): string {
    return env.STORAGE_RAW_PREFIX ?? "raw";
}

function mapRawSuffixToDocJson(suffix: string): string {
    if (/\.pdf$/i.test(suffix)) {
        return suffix.replace(/\.pdf$/i, ".json");
    }
    return suffix;
}

/**
 * Mirror a raw/ object key to doc_json/ with the same inner path.
 * Leaf .pdf files become .json; other extensions are unchanged.
 */
export function toDocJsonDataLakeKey(objectKey: string): string | null {
    const normalized = normalizeStorageKey(objectKey);
    const rawPrefix = resolveRawStoragePrefix();

    if (normalized.startsWith(`${DOC_JSON_PREFIX}/`)) {
        return normalized;
    }
    if (!normalized.startsWith(`${rawPrefix}/`)) {
        return null;
    }

    const suffix = normalized.slice(rawPrefix.length + 1);
    return `${DOC_JSON_PREFIX}/${mapRawSuffixToDocJson(suffix)}`;
}

/** Prefix for listing objects under doc_json/ mirroring a raw folder path. */
export function toDocJsonDataLakePrefix(folderOrKeyPath: string): string | null {
    const mirrored = toDocJsonDataLakeKey(folderOrKeyPath);
    if (!mirrored) {
        return null;
    }
    return mirrored.replace(/\/?$/, "/");
}

export function expandKeysWithDocJsonMirrors(keys: Set<string>): void {
    for (const key of [...keys]) {
        const docJsonKey = toDocJsonDataLakeKey(key);
        if (docJsonKey) {
            keys.add(docJsonKey);
        }
    }
}

/**
 * Mirror a raw/ folder path to processed OCR metadata key.
 * raw/<root>/<ho_so_id> -> processed/<root>/<ho_so_id>/<ho_so_id>.json
 */
export function toProcessedMetadataKey(folderPath: string): string | null {
    const normalized = normalizeStorageKey(folderPath);
    const rawPrefix = resolveRawStoragePrefix();
    if (!normalized.startsWith(`${rawPrefix}/`)) {
        return null;
    }

    const suffix = normalized.slice(rawPrefix.length + 1);
    const hoSoId = storageBasename(normalized);
    return `${PROCESSED_STORAGE_PREFIX}/${suffix}/${hoSoId}.json`;
}

/**
 * Derive raw folderPath from processed OCR output key.
 * processed/<root>/<ho_so_id>/<ho_so_id>.json -> raw/<root>/<ho_so_id>
 */
export function deriveFolderPathFromProcessedKey(outputPath: string): string {
    const rawPrefix = resolveRawStoragePrefix();
    const normalized = normalizeStorageKey(outputPath);
    const processedPrefix = `${PROCESSED_STORAGE_PREFIX}/`;
    const relative = normalized.startsWith(processedPrefix)
        ? normalized.slice(processedPrefix.length)
        : normalized;
    const folderSuffix = storageDirname(relative.replace(/\.json$/i, ""));
    return folderSuffix ? `${rawPrefix}/${folderSuffix}` : rawPrefix;
}

/** Extract ho_so_id (leaf folder name) from a processed OCR output key. */
export function deriveHoSoIdFromProcessedKey(outputPath: string): string {
    const normalized = normalizeStorageKey(outputPath);
    const processedPrefix = `${PROCESSED_STORAGE_PREFIX}/`;
    const relative = normalized.startsWith(processedPrefix)
        ? normalized.slice(processedPrefix.length)
        : normalized;
    return storageBasename(relative).replace(/\.json$/i, "");
}

/**
 * True only for the canonical OCR worker output:
 * processed/<root>/<ho_so_id>/<ho_so_id>.json
 * Excludes derived keys such as _EDITOR, _CHECKER_*, _RESTORED_*.
 */
export function isCanonicalOcrOutputKey(outputPath: string): boolean {
    const folderPath = deriveFolderPathFromProcessedKey(outputPath);
    const expected = toProcessedMetadataKey(folderPath);
    if (!expected) {
        return false;
    }
    return normalizeStorageKey(outputPath) === expected;
}
