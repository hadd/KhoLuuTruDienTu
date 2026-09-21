import * as path from "node:path";
import { env } from "../../env.ts";

const DOC_JSON_PREFIX = "doc_json";
export const PROCESSED_STORAGE_PREFIX = "processed";
/** TT05 metadata worker output root (parallel to processed/). */
export const TT05_METADATA_STORAGE_PREFIX = "tt05_metadata";
/** PVEP metadata worker output root (parallel to processed/). */
export const PVEP_METADATA_STORAGE_PREFIX = "pvep_metadata";
/** Tuyên Quang metadata worker output root (parallel to processed/). */
export const TUYEN_QUANG_METADATA_STORAGE_PREFIX = "tuyen_quang_metadata";
export const METADATA_OUTPUT_STORAGE_PREFIXES = [
    PROCESSED_STORAGE_PREFIX,
    TT05_METADATA_STORAGE_PREFIX,
    PVEP_METADATA_STORAGE_PREFIX,
    TUYEN_QUANG_METADATA_STORAGE_PREFIX,
] as const;
export type MetadataOutputStoragePrefix =
    (typeof METADATA_OUTPUT_STORAGE_PREFIXES)[number];
export const SEARCHABLE_PDF_STORAGE_PREFIX = "searchable_pdf";
/** Pre-generated PDF/A-2b for metadata export (sibling of raw/). */
export const EXPORT_PDF_STORAGE_PREFIX = "Export/PDF";
/** Pre-generated TIFF for metadata export (sibling of raw/). */
export const EXPORT_TIFF_STORAGE_PREFIX = "Export/TIFF";

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
 * Mirror a known storage object key (e.g. raw/, signed/, processed/) 
 * to searchable_pdf/ with the same inner path.
 */
export function toSearchablePdfKey(objectKey: string): string | null {
    const normalized = normalizeStorageKey(objectKey);

    if (normalized.startsWith(`${SEARCHABLE_PDF_STORAGE_PREFIX}/`)) {
        return normalized;
    }

    const possiblePrefixes = [
        resolveRawStoragePrefix(),
        resolveSignedStoragePrefix(),
        ...METADATA_OUTPUT_STORAGE_PREFIXES,
    ];

    for (const prefix of possiblePrefixes) {
        if (normalized.startsWith(`${prefix}/`)) {
            const suffix = normalized.slice(prefix.length + 1);
            return `${SEARCHABLE_PDF_STORAGE_PREFIX}/${suffix}`;
        }
    }

    return null;
}

/**
 * Inner path after raw/ (or signed/) for Export mirrors.
 * raw/a/b/doc.pdf → a/b/doc.pdf
 */
function rawInnerSuffix(objectKey: string): string | null {
    const normalized = normalizeStorageKey(objectKey);
    const rawPrefix = resolveRawStoragePrefix();
    const signedPrefix = resolveSignedStoragePrefix();

    if (normalized.startsWith(`${rawPrefix}/`)) {
        return normalized.slice(rawPrefix.length + 1);
    }
    if (normalized.startsWith(`${signedPrefix}/`)) {
        return normalized.slice(signedPrefix.length + 1);
    }
    if (normalized.startsWith(`${EXPORT_PDF_STORAGE_PREFIX}/`)) {
        return normalized.slice(EXPORT_PDF_STORAGE_PREFIX.length + 1);
    }
    if (normalized.startsWith(`${EXPORT_TIFF_STORAGE_PREFIX}/`)) {
        return normalized.slice(EXPORT_TIFF_STORAGE_PREFIX.length + 1);
    }
    return null;
}

/** Mirror raw/signed key → Export/PDF/{inner} (same filename, PDF/A-2b content). */
export function toExportPdfKey(objectKey: string): string | null {
    const normalized = normalizeStorageKey(objectKey);
    if (normalized.startsWith(`${EXPORT_PDF_STORAGE_PREFIX}/`)) {
        return normalized;
    }
    const suffix = rawInnerSuffix(objectKey);
    if (!suffix || !/\.pdf$/i.test(suffix)) {
        return null;
    }
    return `${EXPORT_PDF_STORAGE_PREFIX}/${suffix}`;
}

/** Mirror raw/signed key → Export/TIFF/{inner} with .TIFF extension. */
export function toExportTiffKey(objectKey: string): string | null {
    const normalized = normalizeStorageKey(objectKey);
    if (normalized.startsWith(`${EXPORT_TIFF_STORAGE_PREFIX}/`)) {
        return normalized;
    }
    const suffix = rawInnerSuffix(objectKey);
    if (!suffix || !/\.pdf$/i.test(suffix)) {
        return null;
    }
    const tiffSuffix = suffix.replace(/\.pdf$/i, ".TIFF");
    return `${EXPORT_TIFF_STORAGE_PREFIX}/${tiffSuffix}`;
}

/** Prefix for listing Export/PDF objects mirroring a raw folder path. */
export function toExportPdfPrefix(folderOrKeyPath: string): string | null {
    const rawPrefix = resolveRawStoragePrefix();
    const normalized = normalizeStorageKey(folderOrKeyPath);
    if (!normalized.startsWith(`${rawPrefix}/`) && normalized !== rawPrefix) {
        // Try via a synthetic pdf key under the folder
        const asFolder = normalized.replace(/\/?$/, "/");
        if (!asFolder.startsWith(`${rawPrefix}/`)) return null;
        const suffix = asFolder.slice(rawPrefix.length + 1);
        return `${EXPORT_PDF_STORAGE_PREFIX}/${suffix}`;
    }
    const suffix = normalized === rawPrefix
        ? ""
        : normalized.slice(rawPrefix.length + 1);
    const withSlash = suffix ? `${suffix.replace(/\/?$/, "/")}` : "";
    return `${EXPORT_PDF_STORAGE_PREFIX}/${withSlash}`;
}

/** Prefix for listing Export/TIFF objects mirroring a raw folder path. */
export function toExportTiffPrefix(folderOrKeyPath: string): string | null {
    const pdfPrefix = toExportPdfPrefix(folderOrKeyPath);
    if (!pdfPrefix) return null;
    return pdfPrefix.replace(
        `${EXPORT_PDF_STORAGE_PREFIX}/`,
        `${EXPORT_TIFF_STORAGE_PREFIX}/`,
    );
}

/** Add Export/PDF + Export/TIFF mirrors for every raw/signed PDF key in the set. */
export function expandKeysWithExportDerivatives(keys: Set<string>): void {
    for (const key of [...keys]) {
        const pdfKey = toExportPdfKey(key);
        if (pdfKey) keys.add(pdfKey);
        const tiffKey = toExportTiffKey(key);
        if (tiffKey) keys.add(tiffKey);
    }
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
 * Mirror a raw/ folder path to Tuyên Quang metadata key.
 * raw/<root>/<ho_so_id> -> tuyen_quang_metadata/<root>/<ho_so_id>/<ho_so_id>.json
 */
export function toTuyenQuangMetadataKey(folderPath: string): string | null {
    return toMetadataOutputKey(folderPath, TUYEN_QUANG_METADATA_STORAGE_PREFIX);
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

function stripRawPrefix(path: string): string {
  const normalized = normalizeStorageKey(path).replace(/^\/+|\/+$/g, "");
  const rawPrefix = resolveRawStoragePrefix();
  if (normalized === rawPrefix) return "";
  if (normalized.startsWith(`${rawPrefix}/`)) {
    return normalized.slice(rawPrefix.length + 1);
  }
  return normalized;
}

/** True when `path` equals `prefix` or is a child path under `prefix/` (segment-safe). */
function isPathPrefixOrEqual(path: string, prefix: string): boolean {
  if (!prefix) return true;
  if (path === prefix) return true;
  return path.startsWith(`${prefix}/`);
}

export function computeRelativeFolderPath(
  dossierPath: string | null | undefined,
  basePath: string | undefined,
  baseFolderName: string | undefined
): string | undefined {
  if (!dossierPath) return undefined;
  if (!basePath) return undefined;

  const rel = stripRawPrefix(dossierPath);
  const base = stripRawPrefix(basePath);

  if (isPathPrefixOrEqual(rel, base)) {
    if (rel === base) return "";
    return rel.slice(base.length + 1);
  }

  // Fallback: locate selected folder name as a full path segment (not a substring).
  if (baseFolderName) {
    const segments = rel.split("/").filter(Boolean);
    const idx = segments.lastIndexOf(baseFolderName);
    if (idx >= 0) {
      return segments.slice(idx + 1).join("/");
    }
  }

  return rel;
}
