import * as path from "node:path";
import { env } from "../../env.ts";

const DOC_JSON_PREFIX = "doc_json";
export const PROCESSED_STORAGE_PREFIX = "processed";
/** TT05 metadata worker output root (parallel to processed/). */
export const TT05_METADATA_STORAGE_PREFIX = "tt05_metadata";
/** PVEP metadata worker output root (parallel to processed/). */
export const PVEP_METADATA_STORAGE_PREFIX = "pvep_metadata";
export const METADATA_OUTPUT_STORAGE_PREFIXES = [
    PROCESSED_STORAGE_PREFIX,
    TT05_METADATA_STORAGE_PREFIX,
    PVEP_METADATA_STORAGE_PREFIX,
] as const;
export type MetadataOutputStoragePrefix =
    (typeof METADATA_OUTPUT_STORAGE_PREFIXES)[number];
export const SEARCHABLE_PDF_STORAGE_PREFIX = "searchable_pdf";

/** Return processed/ or tt05_metadata/ prefix if present on the key. */
export function getMetadataOutputPrefix(
    outputPath: string,
): MetadataOutputStoragePrefix | null {
    const normalized = normalizeStorageKey(outputPath);
    for (const prefix of METADATA_OUTPUT_STORAGE_PREFIXES) {
        if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
            return prefix;
        }
    }
    return null;
}

function stripMetadataOutputPrefix(normalized: string): string {
    for (const prefix of METADATA_OUTPUT_STORAGE_PREFIXES) {
        const withSlash = `${prefix}/`;
        if (normalized.startsWith(withSlash)) {
            return normalized.slice(withSlash.length);
        }
    }
    return normalized;
}

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

/** The configured raw/ storage prefix (default "raw"). */
export function getRawStoragePrefix(): string {
    return resolveRawStoragePrefix();
}

/** True when a storage key/folder path lives under the raw/ prefix. */
export function isRawStoragePath(path: string | null | undefined): boolean {
    if (!path) {
        return false;
    }
    const normalized = normalizeStorageKey(path);
    const rawPrefix = resolveRawStoragePrefix();
    return normalized === rawPrefix ||
        normalized.startsWith(`${rawPrefix}/`);
}

function resolveSignedStoragePrefix(): string {
    return env.STORAGE_SIGNED_PREFIX ?? "signed";
}

/**
 * Mirror a raw/ object key to signed/ with the same inner path.
 */
export function toSignedPdfKey(objectKey: string): string | null {
    const normalized = normalizeStorageKey(objectKey);
    const rawPrefix = resolveRawStoragePrefix();
    const signedPrefix = resolveSignedStoragePrefix();

    if (normalized.startsWith(`${signedPrefix}/`)) {
        return normalized;
    }
    if (!normalized.startsWith(`${rawPrefix}/`)) {
        return null;
    }

    const suffix = normalized.slice(rawPrefix.length + 1);
    return `${signedPrefix}/${suffix}`;
}

function mapRawSuffixToDocJson(suffix: string): string {
    if (/\.pdf$/i.test(suffix)) {
        return suffix.replace(/\.pdf$/i, ".json");
    }
    return suffix;
}

/**
 * Mirror a raw/ object key to searchable_pdf/ with the same inner path.
 */
export function toSearchablePdfKey(objectKey: string): string | null {
    const normalized = normalizeStorageKey(objectKey);
    const rawPrefix = resolveRawStoragePrefix();

    if (normalized.startsWith(`${SEARCHABLE_PDF_STORAGE_PREFIX}/`)) {
        return normalized;
    }
    if (!normalized.startsWith(`${rawPrefix}/`)) {
        return null;
    }

    const suffix = normalized.slice(rawPrefix.length + 1);
    return `${SEARCHABLE_PDF_STORAGE_PREFIX}/${suffix}`;
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
 * Mirror a raw/ folder path to a metadata output key under the given prefix.
 * raw/<root>/<ho_so_id> -> <prefix>/<root>/<ho_so_id>/<ho_so_id>.json
 */
export function toMetadataOutputKey(
    folderPath: string,
    prefix: MetadataOutputStoragePrefix = PROCESSED_STORAGE_PREFIX,
): string | null {
    const normalized = normalizeStorageKey(folderPath);
    const rawPrefix = resolveRawStoragePrefix();
    if (!normalized.startsWith(`${rawPrefix}/`)) {
        return null;
    }

    const suffix = normalized.slice(rawPrefix.length + 1);
    const hoSoId = storageBasename(normalized);
    return `${prefix}/${suffix}/${hoSoId}.json`;
}

/**
 * Mirror a raw/ folder path to processed OCR metadata key.
 * raw/<root>/<ho_so_id> -> processed/<root>/<ho_so_id>/<ho_so_id>.json
 */
export function toProcessedMetadataKey(folderPath: string): string | null {
    return toMetadataOutputKey(folderPath, PROCESSED_STORAGE_PREFIX);
}

/**
 * Mirror a raw/ folder path to TT05 metadata key.
 * raw/<root>/<ho_so_id> -> tt05_metadata/<root>/<ho_so_id>/<ho_so_id>.json
 */
export function toTt05MetadataKey(folderPath: string): string | null {
    return toMetadataOutputKey(folderPath, TT05_METADATA_STORAGE_PREFIX);
}

/**
 * Mirror a raw/ folder path to PVEP metadata key.
 * raw/<root>/<ho_so_id> -> pvep_metadata/<root>/<ho_so_id>/<ho_so_id>.json
 */
export function toPvepMetadataKey(folderPath: string): string | null {
    return toMetadataOutputKey(folderPath, PVEP_METADATA_STORAGE_PREFIX);
}

/**
 * Derive raw folderPath from metadata output key (processed/ or tt05_metadata/).
 * processed|tt05_metadata/<root>/<ho_so_id>/<ho_so_id>.json -> raw/<root>/<ho_so_id>
 */
export function deriveFolderPathFromProcessedKey(outputPath: string): string {
    const rawPrefix = resolveRawStoragePrefix();
    const normalized = normalizeStorageKey(outputPath);
    const relative = stripMetadataOutputPrefix(normalized);
    const folderSuffix = storageDirname(relative.replace(/\.json$/i, ""));
    return folderSuffix ? `${rawPrefix}/${folderSuffix}` : rawPrefix;
}

/** Extract ho_so_id (leaf folder name) from a metadata output key. */
export function deriveHoSoIdFromProcessedKey(outputPath: string): string {
    const normalized = normalizeStorageKey(outputPath);
    const relative = stripMetadataOutputPrefix(normalized);
    return storageBasename(relative).replace(/\.json$/i, "");
}

/**
 * True only for the canonical worker output:
 * processed|tt05_metadata/<root>/<ho_so_id>/<ho_so_id>.json
 * Excludes derived keys such as _EDITOR, _CHECKER_*, _RESTORED_*.
 */
export function isCanonicalOcrOutputKey(outputPath: string): boolean {
    const normalized = normalizeStorageKey(outputPath);
    const prefix = getMetadataOutputPrefix(normalized);
    if (!prefix) {
        return false;
    }
    const folderPath = deriveFolderPathFromProcessedKey(normalized);
    const expected = toMetadataOutputKey(folderPath, prefix);
    if (!expected) {
        return false;
    }
    return normalized === expected;
}
