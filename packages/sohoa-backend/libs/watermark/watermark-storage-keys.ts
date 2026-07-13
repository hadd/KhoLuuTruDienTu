import { env } from "../../env.ts";
import { normalizeStorageKey } from "../../modules/dossier/dossier-path-utils.ts";

export function getWatermarkStoragePrefix(): string {
    return (env.WATERMARK_STORAGE_PREFIX ?? "images/watermark").replace(/\/+$/, "");
}

export function getWatermarkImageMaxBytes(): number {
    return env.WATERMARK_IMAGE_MAX_BYTES ?? 5_242_880;
}

export function buildWatermarkAssetPrefix(assetId: string): string {
    return `${getWatermarkStoragePrefix()}/${assetId}/`;
}

export function buildWatermarkOriginalKey(assetId: string, ext: "png" | "svg"): string {
    return normalizeStorageKey(`${buildWatermarkAssetPrefix(assetId)}original.${ext}`);
}

export function buildWatermarkRasterKey(assetId: string): string {
    return normalizeStorageKey(`${buildWatermarkAssetPrefix(assetId)}raster.png`);
}

export function isWatermarkStorageKey(key: string): boolean {
    const normalized = normalizeStorageKey(key);
    const prefix = getWatermarkStoragePrefix();
    return normalized === prefix || normalized.startsWith(`${prefix}/`);
}
