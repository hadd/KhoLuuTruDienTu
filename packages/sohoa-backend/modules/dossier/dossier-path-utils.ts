import * as path from "node:path";
import { env } from "../../env.ts";

const DOC_JSON_PREFIX = "doc_json";

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
