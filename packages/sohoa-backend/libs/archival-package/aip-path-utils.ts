import {
    getRawStoragePrefix,
    normalizeStorageKey,
    storageBasename,
} from "../../modules/dossier/dossier-path-utils.ts";
import type { DossierMetadata } from "../metadata-types.ts";

function resolveAipPrefix(): string {
    const raw = Deno.env.get("STORAGE_AIP_PREFIX") ?? "aip";
    return normalizeStorageKey(raw).replace(/\/+$/, "");
}

/** Sanitize tên file ZIP — giữ nguyên tối đa ký tự gốc của ho_so_id / dossier name. */
export function sanitizeArchiveBaseName(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "unknown";
}

export function resolveHoSoId(
    metadata: DossierMetadata,
    dossierName: string,
    dossierId: string,
): string {
    const raw = metadata.ho_so_id?.trim() || dossierName || dossierId;
    return sanitizeArchiveBaseName(raw);
}

export function resolveArchiveBaseName(
    metadata: DossierMetadata,
    dossierName: string,
    dossierId: string,
): string {
    return sanitizeArchiveBaseName(
        metadata.ho_so_id?.trim() || dossierName || dossierId,
    );
}

export function resolveAipZipFileName(baseName: string): string {
    return `${sanitizeArchiveBaseName(baseName)}-AIP_hoso.zip`;
}

export function resolveDipZipFileName(baseName: string): string {
    return `${sanitizeArchiveBaseName(baseName)}-DIP_hoso.zip`;
}

/**
 * ZIP relative path from dossier.folderPath, stripping the warehouse raw/ prefix
 * so parent folders remain (e.g. raw/A/B/HoSo → A/B/HoSo).
 */
export function resolveExportZipRelativePath(
    folderPath: string,
    fallbackName = "export",
): string {
    const normalized = normalizeStorageKey(folderPath).replace(/^\/+|\/+$/g, "");
    const rawPrefix = getRawStoragePrefix();
    let relative = normalized;
    if (relative === rawPrefix) {
        return sanitizeArchiveBaseName(fallbackName);
    }
    if (relative.startsWith(`${rawPrefix}/`)) {
        relative = relative.slice(rawPrefix.length + 1);
    }
    const segments = relative
        .split("/")
        .filter(Boolean)
        .map((segment) => sanitizeArchiveBaseName(segment));
    if (segments.length === 0) {
        return sanitizeArchiveBaseName(fallbackName);
    }
    return segments.join("/");
}

/** Keep nested path separators; uniquify by suffixing the leaf segment when needed. */
export function uniqueZipFolderPath(
    folderPath: string,
    usedPaths: Set<string>,
): string {
    const segments = folderPath
        .split("/")
        .filter(Boolean)
        .map((segment) => sanitizeArchiveBaseName(segment));
    let safePath = segments.join("/") || sanitizeArchiveBaseName("export");
    if (!usedPaths.has(safePath)) {
        usedPaths.add(safePath);
        return safePath;
    }

    const leaf = segments.at(-1) ?? "export";
    const parent = segments.slice(0, -1).join("/");
    let counter = 2;
    while (true) {
        const candidate = parent
            ? `${parent}/${leaf} (${counter})`
            : `${leaf} (${counter})`;
        if (!usedPaths.has(candidate)) {
            usedPaths.add(candidate);
            return candidate;
        }
        counter += 1;
    }
}

/**
 * Key WORM mirror cấu trúc raw/processed:
 * dossier.folderPath = raw/.../{ho_so} → aip/raw/.../{ho_so}/{ho_so}-AIP_hoso.zip
 *
 * Không thêm segment {ho_so_id} thừa — folderPath đã là thư mục hồ sơ thực tế.
 */
export function resolveAipObjectKey(input: {
    folderPath: string;
    metadata: DossierMetadata;
    dossierName: string;
    dossierId: string;
}): string {
    const prefix = resolveAipPrefix();
    const folderPath = normalizeStorageKey(input.folderPath).replace(/^\/+|\/+$/g, "");
    const baseName = resolveArchiveBaseName(input.metadata, input.dossierName, input.dossierId);
    const zipName = resolveAipZipFileName(baseName);
    return `${prefix}/${folderPath}/${zipName}`;
}

/** Leaf folder name từ folderPath (đối chiếu với dossier.name). */
export function resolveFolderLeafName(folderPath: string): string {
    return storageBasename(normalizeStorageKey(folderPath));
}
