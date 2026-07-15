import { httpError } from "@shared/common-lib";
import { normalizeStorageKey } from "../dossier/dossier-path-utils.ts";

export const PHYSICAL_WAREHOUSE_STORAGE_PREFIX = "images/physical-warehouse";
/** Legacy prefix before path was nested under `images/`. */
const LEGACY_PHYSICAL_WAREHOUSE_STORAGE_PREFIX = "physical-warehouse";
export const PHYSICAL_WAREHOUSE_IMAGE_MAX_BYTES = 5_242_880; // 5MB

const ALLOWED_MIME: Record<string, "jpg" | "png" | "webp"> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
};

export function buildPhysicalWarehouseImageKey(
    assetId: string,
    ext: "jpg" | "png" | "webp",
): string {
    return normalizeStorageKey(
        `${PHYSICAL_WAREHOUSE_STORAGE_PREFIX}/${assetId}/original.${ext}`,
    );
}

function matchesPrefix(normalized: string, prefix: string): boolean {
    return normalized === prefix || normalized.startsWith(`${prefix}/`);
}

export function isPhysicalWarehouseImageKey(value: string | null | undefined): boolean {
    if (!value) return false;
    if (value.startsWith("http://") || value.startsWith("https://")) return false;
    const normalized = normalizeStorageKey(value);
    return (
        matchesPrefix(normalized, PHYSICAL_WAREHOUSE_STORAGE_PREFIX) ||
        matchesPrefix(normalized, LEGACY_PHYSICAL_WAREHOUSE_STORAGE_PREFIX)
    );
}

export function detectImageExtension(
    mimeType: string,
    filename: string,
): "jpg" | "png" | "webp" {
    const fromMime = mimeType ? ALLOWED_MIME[mimeType.toLowerCase()] : undefined;
    if (fromMime) return fromMime;

    const lower = filename.toLowerCase();
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpg";
    if (lower.endsWith(".png")) return "png";
    if (lower.endsWith(".webp")) return "webp";

    throw httpError.badRequest("Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP");
}

export function assertPhysicalWarehouseImageFile(file: File) {
    if (file.size <= 0 || file.size > PHYSICAL_WAREHOUSE_IMAGE_MAX_BYTES) {
        throw httpError.badRequest(
            `Kích thước ảnh không hợp lệ (tối đa ${Math.floor(PHYSICAL_WAREHOUSE_IMAGE_MAX_BYTES / (1024 * 1024))}MB)`,
        );
    }

    const mime = (file.type || "").toLowerCase();
    const filename = file.name || "image.jpg";
    const ext = detectImageExtension(mime, filename);
    const contentType =
        ext === "jpg" ? "image/jpeg" : ext === "png" ? "image/png" : "image/webp";

    return { ext, contentType };
}
