import { eq } from "drizzle-orm";
import { httpError, logApi } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import {
    watermarkImageAssets,
    watermarkPlacements,
    type WatermarkPosition,
} from "../../db/schemas/watermark.ts";
import { downloadBinaryFromStorage } from "../../modules/data-entry/data-entry-s3-utils.ts";
import {
    applyWatermarkToPdfBytes,
    type WatermarkApplyConfig,
} from "./pdf-watermark-applier.ts";

export type WatermarkablePdfFile = {
    fileName: string;
    data: Uint8Array;
};

/** Parallelism for CPU-heavy pdf-lib work; each file gets its own PNG copy. */
const WATERMARK_CONCURRENCY = 3;

function cloneApplyConfig(config: WatermarkApplyConfig): WatermarkApplyConfig {
    return {
        ...config,
        // Independent copy so embedPng never mutates the shared source buffer.
        imagePngBytes: config.imagePngBytes
            ? new Uint8Array(config.imagePngBytes)
            : null,
    };
}

function asPosition(value: string | null | undefined): WatermarkPosition {
    const allowed = new Set([
        "center",
        "top_left",
        "top_right",
        "bottom_left",
        "bottom_right",
        "tile_grid",
        "custom",
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
 * Resolve placement + image into an apply config once (reusable across dossiers).
 * Returns null when placementId is missing/empty or placement has nothing to apply.
 */
export async function resolveWatermarkApplyConfig(
    placementId?: string | null,
): Promise<WatermarkApplyConfig | null> {
    const id = placementId?.trim();
    if (!id) {
        return null;
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
        return null;
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
        return null;
    }

    return {
        textEnabled,
        textContent: placement.textContent,
        textOpacity: placement.textOpacity,
        textPosition: asPosition(placement.textPosition),
        textSizePercent: placement.textSizePercent,
        textOffsetXPercent: placement.textOffsetXPercent ?? null,
        textOffsetYPercent: placement.textOffsetYPercent ?? null,
        textRotationDegrees: placement.textRotationDegrees ?? 0,
        textStamps: placement.textStamps ?? null,
        imageEnabled: Boolean(imagePngBytes),
        imageOpacity: placement.imageOpacity,
        imagePosition: asPosition(placement.imagePosition),
        imageSizePercent: placement.imageSizePercent,
        imageOffsetXPercent: placement.imageOffsetXPercent ?? null,
        imageOffsetYPercent: placement.imageOffsetYPercent ?? null,
        imageRotationDegrees: placement.imageRotationDegrees ?? 0,
        imageStamps: placement.imageStamps ?? null,
        imagePngBytes,
    };
}

async function mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let nextIndex = 0;

    async function worker() {
        while (true) {
            const index = nextIndex++;
            if (index >= items.length) return;
            results[index] = await fn(items[index]!, index);
        }
    }

    const workerCount = Math.min(Math.max(1, concurrency), items.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}

/**
 * Apply a pre-resolved watermark config to every PDF in the batch.
 * No-op when config is null. Throws if any file fails (does not return originals).
 */
export async function applyWatermarkConfigToPdfFiles<T extends WatermarkablePdfFile>(
    pdfFiles: T[],
    config: WatermarkApplyConfig | null,
): Promise<T[]> {
    if (!config || pdfFiles.length === 0) {
        return pdfFiles;
    }

    const outcomes = await mapWithConcurrency(
        pdfFiles,
        WATERMARK_CONCURRENCY,
        async (file) => {
            try {
                const data = await applyWatermarkToPdfBytes(
                    file.data,
                    cloneApplyConfig(config),
                );
                // Flatten (JPEG pages) can shrink the file vs the original scan PDF;
                // size is not a valid success signal.
                if (data.byteLength === 0) {
                    throw new Error("Watermark produced empty PDF");
                }
                return { ok: true as const, file: { ...file, data } };
            } catch (err) {
                logApi.error(
                    { err, fileName: file.fileName },
                    "[watermark] Failed to apply watermark",
                );
                return { ok: false as const, fileName: file.fileName, file };
            }
        },
    );

    const failures = outcomes
        .filter((o): o is { ok: false; fileName: string; file: T } => !o.ok)
        .map((o) => o.fileName);
    if (failures.length > 0) {
        throw httpError.badRequest(
            `Không gắn được watermark cho PDF: ${failures.join(", ")}`,
        );
    }

    logApi.info(
        { count: outcomes.length, files: pdfFiles.map((f) => f.fileName) },
        "[watermark] Applied watermark to all PDFs in batch",
    );

    return outcomes.map((o) => o.file);
}

/**
 * Apply exactly one watermark placement to every PDF in the batch.
 * No-op when placementId is missing/empty.
 */
export async function maybeWatermarkPdfFiles<T extends WatermarkablePdfFile>(
    pdfFiles: T[],
    placementId?: string | null,
): Promise<T[]> {
    const config = await resolveWatermarkApplyConfig(placementId);
    return applyWatermarkConfigToPdfFiles(pdfFiles, config);
}
