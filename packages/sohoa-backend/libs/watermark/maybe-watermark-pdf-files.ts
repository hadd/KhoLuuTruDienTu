import { eq } from "drizzle-orm";
import { httpError, logApi } from "@shared/common-lib";
import { db } from "../../db/db-conn.ts";
import {
  WATERMARK_PDF_SECURITY_DEFAULT_KEY,
  watermarkImageAssets,
  watermarkPdfSecurity,
  watermarkPlacements,
  type WatermarkPosition,
} from "../../db/schemas/watermark.ts";
import { downloadBinaryFromStorage } from "../../modules/data-entry/data-entry-s3-utils.ts";
import { mapWithConcurrency } from "../export-concurrency.ts";
import {
  applyWatermarkToPdfBytes,
  type WatermarkApplyConfig,
} from "./pdf-watermark-applier.ts";
import {
  encryptPdfWithRestrictions,
  type PdfSecurityRestrictions,
} from "./pdf-security.ts";

export type WatermarkablePdfFile = {
  fileName: string;
  data: Uint8Array;
};

/** Parallelism for CPU-heavy pdf-lib / mupdf work. */
const WATERMARK_CONCURRENCY = 5;

const DEFAULT_PDF_SECURITY: PdfSecurityRestrictions = {
  enabled: false,
  allowPrinting: true,
  allowChanging: false,
  allowDocumentAssembly: false,
  allowContentCopying: false,
  allowContentCopyingAccessibility: true,
  allowPageExtraction: false,
  allowCommenting: false,
  allowFormFilling: true,
  allowSigning: false,
};

export async function loadPdfSecurityRestrictions(): Promise<PdfSecurityRestrictions> {
  const row = await db.query.watermarkPdfSecurity.findFirst({
    where: eq(watermarkPdfSecurity.key, WATERMARK_PDF_SECURITY_DEFAULT_KEY),
  });
  if (!row) return { ...DEFAULT_PDF_SECURITY };
  return {
    enabled: row.enabled,
    allowPrinting: row.allowPrinting,
    allowChanging: row.allowChanging,
    allowDocumentAssembly: row.allowDocumentAssembly,
    allowContentCopying: row.allowContentCopying,
    allowContentCopyingAccessibility: row.allowContentCopyingAccessibility,
    allowPageExtraction: row.allowPageExtraction,
    allowCommenting: row.allowCommenting,
    allowFormFilling: row.allowFormFilling,
    allowSigning: row.allowSigning,
  };
}

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

async function resolveImagePngBytes(
  assetId: string | null,
): Promise<Uint8Array | null> {
  if (!assetId) return null;

  const asset = await db.query.watermarkImageAssets.findFirst({
    where: eq(watermarkImageAssets.id, assetId),
  });
  if (!asset || asset.status === "deleted") {
    return null;
  }

  const key =
    asset.rasterStorageKey ||
    (asset.mimeType === "image/png" ? asset.storageKey : null);
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
    logApi.error(
      { err, key },
      "[watermark] Failed to download watermark image",
    );
    return null;
  }
}

/**
 * Resolve placement + image into an apply config once (reusable across dossiers).
 * Resolves an explicit placement, or the single active placement when requested.
 */
export async function resolveWatermarkApplyConfig(
  placementId?: string | null,
  useActivePlacement = false,
): Promise<WatermarkApplyConfig | null> {
  const id = placementId?.trim();
  if (!id && !useActivePlacement) {
    return null;
  }

  const placement = await db.query.watermarkPlacements.findFirst({
    where: id
      ? eq(watermarkPlacements.id, id)
      : eq(watermarkPlacements.isActive, true),
  });
  if (!placement) {
    throw httpError.badRequest(
      id
        ? "placementId không tồn tại"
        : "Chưa có cấu hình watermark nào được bật",
    );
  }

  const textEnabled =
    placement.textEnabled && Boolean(placement.textContent?.trim());
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

/**
 * Apply a pre-resolved watermark config to every PDF in the batch.
 * No-op when config is null. Throws if any file fails (does not return originals).
 * Mutates each file's `data` in place and drops the previous buffer so GC can reclaim RAM.
 */
export async function applyWatermarkConfigToPdfFiles<
  T extends WatermarkablePdfFile,
>(pdfFiles: T[], config: WatermarkApplyConfig | null): Promise<T[]> {
  if (!config || pdfFiles.length === 0) {
    return pdfFiles;
  }

  const security = await loadPdfSecurityRestrictions();

  const outcomes = await mapWithConcurrency(
    pdfFiles,
    WATERMARK_CONCURRENCY,
    async (file) => {
      try {
        const original = file.data;
        let data = await applyWatermarkToPdfBytes(
          original,
          cloneApplyConfig(config),
        );
        if (data.byteLength === 0) {
          throw new Error("Watermark produced empty PDF");
        }
        if (security.enabled) {
          data = await encryptPdfWithRestrictions(data, security);
        }
        file.data = data;
        return { ok: true as const, fileName: file.fileName };
      } catch (err) {
        logApi.error(
          { err, fileName: file.fileName },
          "[watermark] Failed to apply watermark",
        );
        return { ok: false as const, fileName: file.fileName };
      }
    },
  );

  const failures = outcomes
    .filter((o): o is { ok: false; fileName: string } => !o.ok)
    .map((o) => o.fileName);
  if (failures.length > 0) {
    throw httpError.badRequest(
      `Không gắn được watermark cho PDF: ${failures.join(", ")}`,
    );
  }

  logApi.info(
    {
      count: outcomes.length,
      files: pdfFiles.map((f) => f.fileName),
      pdfSecurityEnabled: security.enabled,
    },
    "[watermark] Applied watermark to all PDFs in batch",
  );

  return pdfFiles;
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
