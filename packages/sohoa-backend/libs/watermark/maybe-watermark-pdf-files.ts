import { eq } from "drizzle-orm";
import { logApi } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import {
    watermarkConfigs,
    watermarkImageAssets,
    type WatermarkPosition,
} from "../../db/schemas/watermark.ts";
import { downloadBinaryFromStorage } from "../../modules/data-entry/data-entry-s3-utils.ts";
import { applyWatermarkToPdfBytes } from "./pdf-watermark-applier.ts";

export type WatermarkablePdfFile = {
    fileName: string;
    data: Uint8Array;
};

function asPosition(value: string | null | undefined): WatermarkPosition {
    const allowed = new Set([
        "center",
        "top_left",
        "top_right",
        "bottom_left",
        "bottom_right",
        "tile_grid",
    ]);
    if (value && allowed.has(value)) {
        return value as WatermarkPosition;
    }
    return "center";
}

async function resolveImagePngBytes(assetId: string | null): Promise<Uint8Array | null> {
    if (!assetId) return null;

    const asset = await db.query.watermarkImageAssets.findFirst({
        where: eq(watermarkImageAssets.id, assetId),
    });
    if (!asset || asset.status === "deleted") {
        return null;
    }

    const key = asset.rasterStorageKey || (
        asset.mimeType === "image/png" ? asset.storageKey : null
    );
    if (!key) {
        logApi.warn(
            { assetId: asset.id, mimeType: asset.mimeType },
            "[watermark] Image asset has no PNG raster; skipping image layer",
        );
        return null;
    }

    try {
        return await downloadBinaryFromStorage(key);
    } catch (err) {
        logApi.error({ err, key }, "[watermark] Failed to download watermark image");
        return null;
    }
}

/**
 * Load system watermark config once and apply to every PDF in the batch.
 * No-op when both text and image are disabled.
 */
export async function maybeWatermarkPdfFiles<T extends WatermarkablePdfFile>(
    pdfFiles: T[],
): Promise<T[]> {
    if (pdfFiles.length === 0) {
        return pdfFiles;
    }

    const config = await db.query.watermarkConfigs.findFirst({
        orderBy: (table, { asc }) => [asc(table.createdAt)],
    });

    if (!config) {
        return pdfFiles;
    }

    const textEnabled = config.textEnabled && Boolean(config.textContent?.trim());
    const imageEnabled = config.imageEnabled;
    if (!textEnabled && !imageEnabled) {
        return pdfFiles;
    }

    const imagePngBytes = imageEnabled
        ? await resolveImagePngBytes(config.activeImageAssetId)
        : null;

    if (!textEnabled && !imagePngBytes) {
        return pdfFiles;
    }

    const applyConfig = {
        textEnabled,
        textContent: config.textContent,
        textOpacity: config.textOpacity,
        textPosition: asPosition(config.textPosition),
        textSizePercent: config.textSizePercent,
        imageEnabled: Boolean(imagePngBytes),
        imageOpacity: config.imageOpacity,
        imagePosition: asPosition(config.imagePosition),
        imageSizePercent: config.imageSizePercent,
        imagePngBytes,
    };

    const result: T[] = [];
    for (const file of pdfFiles) {
        try {
            const data = await applyWatermarkToPdfBytes(file.data, applyConfig);
            result.push({ ...file, data });
        } catch (err) {
            logApi.error(
                { err, fileName: file.fileName },
                "[watermark] Failed to apply watermark; returning original PDF",
            );
            result.push(file);
        }
    }
    return result;
}
