import { eq } from "drizzle-orm";
import { httpError, logApi } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import {
    watermarkImageAssets,
    watermarkPlacements,
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
 * Apply exactly one watermark placement to every PDF in the batch.
 * No-op when placementId is missing/empty.
 */
export async function maybeWatermarkPdfFiles<T extends WatermarkablePdfFile>(
    pdfFiles: T[],
    placementId?: string | null,
): Promise<T[]> {
    if (pdfFiles.length === 0) {
        return pdfFiles;
    }

    const id = placementId?.trim();
    if (!id) {
        return pdfFiles;
    }

    const placement = await db.query.watermarkPlacements.findFirst({
        where: eq(watermarkPlacements.id, id),
    });
    if (!placement) {
        throw httpError.badRequest("placementId không tồn tại");
    }

    const textEnabled = placement.textEnabled && Boolean(placement.textContent?.trim());
    const imageEnabled = placement.imageEnabled;
    if (!textEnabled && !imageEnabled) {
        return pdfFiles;
    }

    const imagePngBytes = imageEnabled
        ? await resolveImagePngBytes(placement.imageAssetId)
        : null;

    if (!textEnabled && !imagePngBytes) {
        if (imageEnabled) {
            throw httpError.badRequest(
                "Placement bật ảnh nhưng không tải được PNG raster (thử upload PNG)",
            );
        }
        return pdfFiles;
    }

    const applyConfig = {
        textEnabled,
        textContent: placement.textContent,
        textOpacity: placement.textOpacity,
        textPosition: asPosition(placement.textPosition),
        textSizePercent: placement.textSizePercent,
        imageEnabled: Boolean(imagePngBytes),
        imageOpacity: placement.imageOpacity,
        imagePosition: asPosition(placement.imagePosition),
        imageSizePercent: placement.imageSizePercent,
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
