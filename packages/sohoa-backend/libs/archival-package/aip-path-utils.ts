import { normalizeStorageKey, storageBasename } from "../../modules/dossier/dossier-path-utils.ts";
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
