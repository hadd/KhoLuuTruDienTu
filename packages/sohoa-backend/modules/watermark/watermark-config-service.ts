import { httpError } from "@shared/common-lib";
import { count, desc, eq } from "drizzle-orm";
import { Buffer } from "node:buffer";
import { db } from "../../db/db-conn.ts";
import {
  WATERMARK_POSITION_VALUES,
  type WatermarkImageAsset,
  watermarkImageAssets,
  type WatermarkPlacement,
  watermarkPlacements,
  type WatermarkPosition,
  type WatermarkStamp,
} from "../../db/schemas/watermark.ts";
import { env } from "../../env.ts";
import { getS3Client } from "../../libs/s3.ts";
import {
  buildWatermarkOriginalKey,
  getWatermarkImageMaxBytes,
} from "../../libs/watermark/watermark-storage-keys.ts";
import { validateWatermarkImageBytes } from "../../libs/watermark/watermark-image-validator.ts";
import type {
  WatermarkImageRecord,
  WatermarkPlacementInput,
  WatermarkPlacementRecord,
  WatermarkPlacementSummary,
  WatermarkUploadImageInput,
} from "./types.ts";

const MAX_STAMPS = 20;

function resolveS3Bucket(): string {
  const bucket = env.S3?.bucket;
  if (!bucket) {
    throw httpError.serviceUnavailable("S3 bucket is not configured");
  }
  return bucket;
}

function assertOpacity(value: number, field: string) {
  if (!Number.isInteger(value) || value < 5 || value > 50) {
    throw httpError.badRequest(`${field} phải là số nguyên trong khoảng 5–50`);
  }
}

function assertSizePercent(value: number, field: string) {
  if (!Number.isInteger(value) || value < 5 || value > 100) {
    throw httpError.badRequest(`${field} phải là số nguyên trong khoảng 5–100`);
  }
}

function assertOffsetPercent(value: number, field: string) {
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw httpError.badRequest(`${field} phải là số nguyên trong khoảng 0–100`);
  }
}

function assertRotation(value: number, field: string) {
  if (!Number.isInteger(value) || value < -180 || value > 180) {
    throw httpError.badRequest(
      `${field} phải là số nguyên trong khoảng -180…180`,
    );
  }
}

function assertPosition(value: string, field: string): WatermarkPosition {
  if (!(WATERMARK_POSITION_VALUES as readonly string[]).includes(value)) {
    throw httpError.badRequest(
      `${field} không hợp lệ. Cho phép: ${WATERMARK_POSITION_VALUES.join(", ")}`,
    );
  }
  return value as WatermarkPosition;
}

function normalizeStamps(
  stamps: WatermarkStamp[] | null,
  field: string,
): WatermarkStamp[] | null {
  if (stamps === null) return null;
  if (!Array.isArray(stamps)) {
    throw httpError.badRequest(`${field} phải là mảng`);
  }
  if (stamps.length === 0) return null;
  if (stamps.length > MAX_STAMPS) {
    throw httpError.badRequest(`${field} tối đa ${MAX_STAMPS} phần tử`);
  }

  return stamps.map((stamp, index) => {
    if (!stamp || typeof stamp !== "object") {
      throw httpError.badRequest(`${field}[${index}] không hợp lệ`);
    }
    assertOffsetPercent(
      stamp.offsetXPercent,
      `${field}[${index}].offsetXPercent`,
    );
    assertOffsetPercent(
      stamp.offsetYPercent,
      `${field}[${index}].offsetYPercent`,
    );
    const rotation = stamp.rotationDegrees;
    if (rotation !== undefined) {
      assertRotation(rotation, `${field}[${index}].rotationDegrees`);
    }
    return {
      offsetXPercent: stamp.offsetXPercent,
      offsetYPercent: stamp.offsetYPercent,
      ...(rotation !== undefined ? { rotationDegrees: rotation } : {}),
    };
  });
}

function assertCustomOffsets(
  position: string,
  stamps: WatermarkStamp[] | null | undefined,
  offsetX: number | null | undefined,
  offsetY: number | null | undefined,
  positionField: string,
  xField: string,
  yField: string,
) {
  if (stamps && stamps.length > 0) return;
  if (position !== "custom") return;
  if (
    offsetX === null ||
    offsetX === undefined ||
    offsetY === null ||
    offsetY === undefined
  ) {
    throw httpError.badRequest(
      `${positionField}=custom thì bắt buộc ${xField} và ${yField} (hoặc dùng stamps)`,
    );
  }
  assertOffsetPercent(offsetX, xField);
  assertOffsetPercent(offsetY, yField);
}

function mapImage(asset: WatermarkImageAsset): WatermarkImageRecord {
  return {
    id: asset.id,
    storageKey: asset.storageKey,
    rasterStorageKey: asset.rasterStorageKey,
    mimeType: asset.mimeType,
    fileSizeBytes: asset.fileSizeBytes,
    originalFilename: asset.originalFilename,
    sha256: asset.sha256,
    status: asset.status,
    uploadedById: asset.uploadedById,
    createdAt: asset.createdAt,
  };
}

function mapPlacement(
  row: WatermarkPlacement,
  asset: WatermarkImageAsset | null = null,
): WatermarkPlacementRecord {
  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    imageAssetId: row.imageAssetId,
    imageEnabled: row.imageEnabled,
    imageOpacity: row.imageOpacity,
    imagePosition: row.imagePosition,
    imageSizePercent: row.imageSizePercent,
    imageOffsetXPercent: row.imageOffsetXPercent ?? null,
    imageOffsetYPercent: row.imageOffsetYPercent ?? null,
    imageRotationDegrees: row.imageRotationDegrees ?? 0,
    imageStamps: row.imageStamps ?? null,
    textEnabled: row.textEnabled,
    textContent: row.textContent,
    textOpacity: row.textOpacity,
    textPosition: row.textPosition,
    textSizePercent: row.textSizePercent,
    textOffsetXPercent: row.textOffsetXPercent ?? null,
    textOffsetYPercent: row.textOffsetYPercent ?? null,
    textRotationDegrees: row.textRotationDegrees ?? 0,
    textStamps: row.textStamps ?? null,
    imageAsset: asset ? mapImage(asset) : null,
    updatedById: row.updatedById,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
  };
}

function mapPlacementSummary(
  row: WatermarkPlacement,
  asset: WatermarkImageAsset | null = null,
): WatermarkPlacementSummary {
  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    imageEnabled: row.imageEnabled,
    imagePosition: row.imagePosition,
    imageAssetId: row.imageAssetId,
    imageAssetName: asset?.originalFilename ?? null,
    textEnabled: row.textEnabled,
    textContent: row.textContent,
    textPosition: row.textPosition,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
  };
}

async function loadAsset(
  assetId: string | null,
): Promise<WatermarkImageAsset | null> {
  if (!assetId) return null;
  const asset = await db.query.watermarkImageAssets.findFirst({
    where: eq(watermarkImageAssets.id, assetId),
  });
  return asset ?? null;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function assertPlacementContent(
  textEnabled: boolean,
  textContent: string | null | undefined,
  imageEnabled: boolean,
  imageAssetId: string | null | undefined,
) {
  if (textEnabled && !textContent?.trim()) {
    throw httpError.badRequest(
      "Bật watermark text thì phải có nội dung textContent",
    );
  }
  if (imageEnabled && !imageAssetId) {
    throw httpError.badRequest("Bật watermark ảnh thì phải chọn imageAssetId");
  }
}

/** True when placement update replaced/cleared the image asset reference. */
export function shouldCleanupPreviousImageAsset(
  previousImageAssetId: string | null,
  patchHadImageAssetId: boolean,
  nextImageAssetId: string | null,
): boolean {
  return (
    patchHadImageAssetId &&
    previousImageAssetId !== null &&
    previousImageAssetId !== nextImageAssetId
  );
}

async function countImageAssetUsage(assetId: string): Promise<number> {
  const [{ value: usageCount }] = await db
    .select({ value: count() })
    .from(watermarkPlacements)
    .where(eq(watermarkPlacements.imageAssetId, assetId));
  return Number(usageCount);
}

/** Physically remove S3 objects + DB row. Caller must ensure asset is unused. */
async function removeImageAsset(asset: WatermarkImageAsset): Promise<void> {
  const s3 = await getS3Client();
  if (s3) {
    const bucket = resolveS3Bucket();
    const keys = new Set<string>([asset.storageKey]);
    if (asset.rasterStorageKey) keys.add(asset.rasterStorageKey);
    for (const key of keys) {
      try {
        await s3.getMinIOClient().removeObject(bucket, key);
      } catch {
        // Object may already be missing.
      }
    }
  }

  await db
    .delete(watermarkImageAssets)
    .where(eq(watermarkImageAssets.id, asset.id));
}

/**
 * Soft orphan cleanup: no-op if missing or still referenced by any placement.
 * Does not throw when still in use (safe for shared assets).
 */
async function deleteImageIfUnused(
  assetId: string | null | undefined,
): Promise<void> {
  const id = assetId?.trim();
  if (!id) return;

  const asset = await db.query.watermarkImageAssets.findFirst({
    where: eq(watermarkImageAssets.id, id),
  });
  if (!asset) return;

  const usageCount = await countImageAssetUsage(asset.id);
  if (usageCount > 0) return;

  await removeImageAsset(asset);
}

export const WatermarkConfigService = {
  async listImages(): Promise<WatermarkImageRecord[]> {
    const rows = await db.query.watermarkImageAssets.findMany({
      orderBy: [desc(watermarkImageAssets.createdAt)],
      limit: 200,
    });
    return rows.map(mapImage);
  },

  async uploadImage(
    input: WatermarkUploadImageInput,
  ): Promise<WatermarkImageRecord> {
    const s3 = await getS3Client();
    if (!s3) {
      throw httpError.serviceUnavailable("S3 is not configured");
    }

    const originalFilename = (input.file.name || "").trim() || "watermark";
    const maxBytes = getWatermarkImageMaxBytes();
    if (input.file.size <= 0 || input.file.size > maxBytes) {
      throw httpError.badRequest(
        `Kích thước ảnh không hợp lệ (tối đa ${Math.floor(maxBytes / (1024 * 1024))}MB)`,
      );
    }

    const bytes = new Uint8Array(await input.file.arrayBuffer());
    const validated = validateWatermarkImageBytes(bytes, originalFilename);
    const hash = await sha256Hex(validated.bytes);

    const assetId = crypto.randomUUID();
    const canonicalKey = buildWatermarkOriginalKey(
      assetId,
      validated.extension,
    );
    const bucket = resolveS3Bucket();

    await s3
      .getMinIOClient()
      .putObject(
        bucket,
        canonicalKey,
        Buffer.from(validated.bytes),
        validated.bytes.byteLength,
        { "Content-Type": validated.mimeType },
      );

    const rasterStorageKey = validated.kind === "png" ? canonicalKey : null;
    const storedFilename = originalFilename.includes(".")
      ? originalFilename
      : `watermark.${validated.extension}`;

    const [asset] = await db
      .insert(watermarkImageAssets)
      .values({
        id: assetId,
        storageKey: canonicalKey,
        rasterStorageKey,
        mimeType: validated.mimeType,
        fileSizeBytes: validated.bytes.byteLength,
        originalFilename: storedFilename,
        sha256: hash,
        status: "active",
        uploadedById: input.actorId,
      })
      .returning();

    return mapImage(asset);
  },

  async deleteImage(assetId: string): Promise<{ deleted: true }> {
    const id = assetId.trim();
    const asset = await db.query.watermarkImageAssets.findFirst({
      where: eq(watermarkImageAssets.id, id),
    });
    if (!asset) {
      throw httpError.notFound("Không tìm thấy ảnh watermark");
    }

    const usageCount = await countImageAssetUsage(asset.id);
    if (usageCount > 0) {
      throw httpError.badRequest(
        `Ảnh đang được dùng bởi ${usageCount} cấu hình placement — hãy gỡ hoặc đổi ảnh trên placement trước`,
      );
    }

    await removeImageAsset(asset);
    return { deleted: true };
  },

  async listPlacements(): Promise<WatermarkPlacementSummary[]> {
    const rows = await db.query.watermarkPlacements.findMany({
      orderBy: [desc(watermarkPlacements.createdAt)],
      with: { imageAsset: true },
    });
    return rows.map((row) => mapPlacementSummary(row, row.imageAsset ?? null));
  },

  async getPlacement(placementId: string): Promise<WatermarkPlacementRecord> {
    const row = await db.query.watermarkPlacements.findFirst({
      where: eq(watermarkPlacements.id, placementId.trim()),
      with: { imageAsset: true },
    });
    if (!row) {
      throw httpError.notFound("Không tìm thấy watermark placement");
    }
    return mapPlacement(row, row.imageAsset ?? null);
  },

  async createPlacement(
    input: WatermarkPlacementInput,
    actorId: string,
  ): Promise<WatermarkPlacementRecord> {
    const name = (input.name ?? "").trim();
    if (!name) {
      throw httpError.badRequest("name là bắt buộc");
    }

    const imageAssetId =
      input.imageAssetId === undefined
        ? null
        : input.imageAssetId?.trim() || null;
    if (imageAssetId) {
      const asset = await loadAsset(imageAssetId);
      if (!asset) {
        throw httpError.badRequest("imageAssetId không tồn tại");
      }
    }

    const textEnabled = input.textEnabled ?? false;
    const textContent =
      input.textContent === undefined
        ? null
        : input.textContent?.trim() || null;
    const imageEnabled = input.imageEnabled ?? false;

    assertPlacementContent(
      textEnabled,
      textContent,
      imageEnabled,
      imageAssetId,
    );

    if (input.textOpacity !== undefined) {
      assertOpacity(input.textOpacity, "textOpacity");
    }
    if (input.imageOpacity !== undefined) {
      assertOpacity(input.imageOpacity, "imageOpacity");
    }
    if (input.textSizePercent !== undefined) {
      assertSizePercent(input.textSizePercent, "textSizePercent");
    }
    if (input.imageSizePercent !== undefined) {
      assertSizePercent(input.imageSizePercent, "imageSizePercent");
    }

    const imagePosition = input.imagePosition
      ? assertPosition(input.imagePosition, "imagePosition")
      : "center";
    const textPosition = input.textPosition
      ? assertPosition(input.textPosition, "textPosition")
      : "center";

    const imageStamps =
      input.imageStamps !== undefined
        ? normalizeStamps(input.imageStamps, "imageStamps")
        : null;
    const textStamps =
      input.textStamps !== undefined
        ? normalizeStamps(input.textStamps, "textStamps")
        : null;

    const imageRotation = input.imageRotationDegrees ?? 0;
    const textRotation = input.textRotationDegrees ?? 0;
    assertRotation(imageRotation, "imageRotationDegrees");
    assertRotation(textRotation, "textRotationDegrees");

    let imageOffsetX = input.imageOffsetXPercent ?? null;
    let imageOffsetY = input.imageOffsetYPercent ?? null;
    let textOffsetX = input.textOffsetXPercent ?? null;
    let textOffsetY = input.textOffsetYPercent ?? null;

    if (
      imagePosition !== "custom" &&
      !(imageStamps && imageStamps.length > 0)
    ) {
      imageOffsetX = null;
      imageOffsetY = null;
    }
    if (textPosition !== "custom" && !(textStamps && textStamps.length > 0)) {
      textOffsetX = null;
      textOffsetY = null;
    }

    assertCustomOffsets(
      imagePosition,
      imageStamps,
      imageOffsetX,
      imageOffsetY,
      "imagePosition",
      "imageOffsetXPercent",
      "imageOffsetYPercent",
    );
    assertCustomOffsets(
      textPosition,
      textStamps,
      textOffsetX,
      textOffsetY,
      "textPosition",
      "textOffsetXPercent",
      "textOffsetYPercent",
    );

    const [created] = await db
      .insert(watermarkPlacements)
      .values({
        name,
        imageAssetId,
        imageEnabled,
        imageOpacity: input.imageOpacity ?? 30,
        imagePosition,
        imageSizePercent: input.imageSizePercent ?? 30,
        imageOffsetXPercent: imageOffsetX,
        imageOffsetYPercent: imageOffsetY,
        imageRotationDegrees: imageRotation,
        imageStamps,
        textEnabled,
        textContent,
        textOpacity: input.textOpacity ?? 30,
        textPosition,
        textSizePercent: input.textSizePercent ?? 20,
        textOffsetXPercent: textOffsetX,
        textOffsetYPercent: textOffsetY,
        textRotationDegrees: textRotation,
        textStamps,
        updatedById: actorId,
        updatedAt: new Date(),
      })
      .returning();

    const asset = await loadAsset(created.imageAssetId);
    return mapPlacement(created, asset);
  },

  async updatePlacement(
    placementId: string,
    input: WatermarkPlacementInput,
    actorId: string,
  ): Promise<WatermarkPlacementRecord> {
    const current = await db.query.watermarkPlacements.findFirst({
      where: eq(watermarkPlacements.id, placementId.trim()),
    });
    if (!current) {
      throw httpError.notFound("Không tìm thấy watermark placement");
    }

    const previousImageAssetId = current.imageAssetId;

    const patch: Partial<typeof watermarkPlacements.$inferInsert> = {
      updatedById: actorId,
      updatedAt: new Date(),
    };

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw httpError.badRequest("name không được để trống");
      patch.name = name;
    }
    if (input.imageAssetId !== undefined) {
      const imageAssetId = input.imageAssetId?.trim() || null;
      if (imageAssetId) {
        const asset = await loadAsset(imageAssetId);
        if (!asset) throw httpError.badRequest("imageAssetId không tồn tại");
      }
      patch.imageAssetId = imageAssetId;
    }
    if (input.imageEnabled !== undefined) {
      patch.imageEnabled = input.imageEnabled;
    }
    if (input.imageOpacity !== undefined) {
      assertOpacity(input.imageOpacity, "imageOpacity");
      patch.imageOpacity = input.imageOpacity;
    }
    if (input.imagePosition !== undefined) {
      patch.imagePosition = assertPosition(
        input.imagePosition,
        "imagePosition",
      );
    }
    if (input.imageSizePercent !== undefined) {
      assertSizePercent(input.imageSizePercent, "imageSizePercent");
      patch.imageSizePercent = input.imageSizePercent;
    }
    if (input.imageOffsetXPercent !== undefined) {
      if (input.imageOffsetXPercent !== null) {
        assertOffsetPercent(input.imageOffsetXPercent, "imageOffsetXPercent");
      }
      patch.imageOffsetXPercent = input.imageOffsetXPercent;
    }
    if (input.imageOffsetYPercent !== undefined) {
      if (input.imageOffsetYPercent !== null) {
        assertOffsetPercent(input.imageOffsetYPercent, "imageOffsetYPercent");
      }
      patch.imageOffsetYPercent = input.imageOffsetYPercent;
    }
    if (input.imageRotationDegrees !== undefined) {
      assertRotation(input.imageRotationDegrees, "imageRotationDegrees");
      patch.imageRotationDegrees = input.imageRotationDegrees;
    }
    if (input.imageStamps !== undefined) {
      patch.imageStamps = normalizeStamps(input.imageStamps, "imageStamps");
    }
    if (input.textEnabled !== undefined) patch.textEnabled = input.textEnabled;
    if (input.textContent !== undefined) {
      patch.textContent = input.textContent?.trim() || null;
    }
    if (input.textOpacity !== undefined) {
      assertOpacity(input.textOpacity, "textOpacity");
      patch.textOpacity = input.textOpacity;
    }
    if (input.textPosition !== undefined) {
      patch.textPosition = assertPosition(input.textPosition, "textPosition");
    }
    if (input.textSizePercent !== undefined) {
      assertSizePercent(input.textSizePercent, "textSizePercent");
      patch.textSizePercent = input.textSizePercent;
    }
    if (input.textOffsetXPercent !== undefined) {
      if (input.textOffsetXPercent !== null) {
        assertOffsetPercent(input.textOffsetXPercent, "textOffsetXPercent");
      }
      patch.textOffsetXPercent = input.textOffsetXPercent;
    }
    if (input.textOffsetYPercent !== undefined) {
      if (input.textOffsetYPercent !== null) {
        assertOffsetPercent(input.textOffsetYPercent, "textOffsetYPercent");
      }
      patch.textOffsetYPercent = input.textOffsetYPercent;
    }
    if (input.textRotationDegrees !== undefined) {
      assertRotation(input.textRotationDegrees, "textRotationDegrees");
      patch.textRotationDegrees = input.textRotationDegrees;
    }
    if (input.textStamps !== undefined) {
      patch.textStamps = normalizeStamps(input.textStamps, "textStamps");
    }

    const nextTextEnabled = patch.textEnabled ?? current.textEnabled;
    const nextTextContent =
      patch.textContent !== undefined ? patch.textContent : current.textContent;
    const nextImageEnabled = patch.imageEnabled ?? current.imageEnabled;
    const nextImageAssetId =
      patch.imageAssetId !== undefined
        ? patch.imageAssetId
        : current.imageAssetId;

    assertPlacementContent(
      nextTextEnabled,
      nextTextContent,
      nextImageEnabled,
      nextImageAssetId,
    );

    const nextImagePosition = patch.imagePosition ?? current.imagePosition;
    const nextTextPosition = patch.textPosition ?? current.textPosition;
    const nextImageStamps =
      patch.imageStamps !== undefined ? patch.imageStamps : current.imageStamps;
    const nextTextStamps =
      patch.textStamps !== undefined ? patch.textStamps : current.textStamps;
    const nextImageOffsetX =
      patch.imageOffsetXPercent !== undefined
        ? patch.imageOffsetXPercent
        : current.imageOffsetXPercent;
    const nextImageOffsetY =
      patch.imageOffsetYPercent !== undefined
        ? patch.imageOffsetYPercent
        : current.imageOffsetYPercent;
    const nextTextOffsetX =
      patch.textOffsetXPercent !== undefined
        ? patch.textOffsetXPercent
        : current.textOffsetXPercent;
    const nextTextOffsetY =
      patch.textOffsetYPercent !== undefined
        ? patch.textOffsetYPercent
        : current.textOffsetYPercent;

    if (
      nextImagePosition !== "custom" &&
      !(nextImageStamps && nextImageStamps.length > 0) &&
      (patch.imagePosition !== undefined || patch.imageStamps !== undefined)
    ) {
      patch.imageOffsetXPercent = null;
      patch.imageOffsetYPercent = null;
    }
    if (
      nextTextPosition !== "custom" &&
      !(nextTextStamps && nextTextStamps.length > 0) &&
      (patch.textPosition !== undefined || patch.textStamps !== undefined)
    ) {
      patch.textOffsetXPercent = null;
      patch.textOffsetYPercent = null;
    }

    assertCustomOffsets(
      nextImagePosition,
      nextImageStamps,
      patch.imageOffsetXPercent !== undefined
        ? patch.imageOffsetXPercent
        : nextImageOffsetX,
      patch.imageOffsetYPercent !== undefined
        ? patch.imageOffsetYPercent
        : nextImageOffsetY,
      "imagePosition",
      "imageOffsetXPercent",
      "imageOffsetYPercent",
    );
    assertCustomOffsets(
      nextTextPosition,
      nextTextStamps,
      patch.textOffsetXPercent !== undefined
        ? patch.textOffsetXPercent
        : nextTextOffsetX,
      patch.textOffsetYPercent !== undefined
        ? patch.textOffsetYPercent
        : nextTextOffsetY,
      "textPosition",
      "textOffsetXPercent",
      "textOffsetYPercent",
    );

    const [updated] = await db
      .update(watermarkPlacements)
      .set(patch)
      .where(eq(watermarkPlacements.id, current.id))
      .returning();

    if (
      shouldCleanupPreviousImageAsset(
        previousImageAssetId,
        input.imageAssetId !== undefined,
        updated.imageAssetId,
      )
    ) {
      await deleteImageIfUnused(previousImageAssetId);
    }

    const asset = await loadAsset(updated.imageAssetId);
    return mapPlacement(updated, asset);
  },

  async setPlacementActive(
    placementId: string,
    isActive: boolean,
    actorId: string,
  ): Promise<WatermarkPlacementRecord> {
    const id = placementId.trim();
    const updated = await db.transaction(async (tx) => {
      const existing = await tx.query.watermarkPlacements.findFirst({
        where: eq(watermarkPlacements.id, id),
      });
      if (!existing) {
        throw httpError.notFound("Không tìm thấy watermark placement");
      }

      if (isActive) {
        await tx
          .update(watermarkPlacements)
          .set({ isActive: false })
          .where(eq(watermarkPlacements.isActive, true));
      }

      const [row] = await tx
        .update(watermarkPlacements)
        .set({
          isActive,
          updatedById: actorId,
          updatedAt: new Date(),
        })
        .where(eq(watermarkPlacements.id, id))
        .returning();
      return row;
    });

    const asset = await loadAsset(updated.imageAssetId);
    return mapPlacement(updated, asset);
  },

  async deletePlacement(placementId: string): Promise<{ deleted: true }> {
    const id = placementId.trim();
    const existing = await db.query.watermarkPlacements.findFirst({
      where: eq(watermarkPlacements.id, id),
    });
    if (!existing) {
      throw httpError.notFound("Không tìm thấy watermark placement");
    }
    const previousImageAssetId = existing.imageAssetId;
    await db.delete(watermarkPlacements).where(eq(watermarkPlacements.id, id));
    await deleteImageIfUnused(previousImageAssetId);
    return { deleted: true };
  },
};
