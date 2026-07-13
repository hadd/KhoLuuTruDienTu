import { httpError } from "@shared/common-lib";
import { count, desc, eq } from "drizzle-orm";
import { Buffer } from "node:buffer";
import { db } from "../../db/db-conn.ts";
import {
    WATERMARK_POSITION_VALUES,
    watermarkImageAssets,
    watermarkPlacements,
    type WatermarkImageAsset,
    type WatermarkPlacement,
    type WatermarkPosition,
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
    WatermarkUploadImageInput,
} from "./types.ts";

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

function assertPosition(value: string, field: string): WatermarkPosition {
    if (!(WATERMARK_POSITION_VALUES as readonly string[]).includes(value)) {
        throw httpError.badRequest(
            `${field} không hợp lệ. Cho phép: ${WATERMARK_POSITION_VALUES.join(", ")}`,
        );
    }
    return value as WatermarkPosition;
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
        imageAssetId: row.imageAssetId,
        imageEnabled: row.imageEnabled,
        imageOpacity: row.imageOpacity,
        imagePosition: row.imagePosition,
        imageSizePercent: row.imageSizePercent,
        textEnabled: row.textEnabled,
        textContent: row.textContent,
        textOpacity: row.textOpacity,
        textPosition: row.textPosition,
        textSizePercent: row.textSizePercent,
        imageAsset: asset ? mapImage(asset) : null,
        updatedById: row.updatedById,
        updatedAt: row.updatedAt,
        createdAt: row.createdAt,
    };
}

async function loadAsset(assetId: string | null): Promise<WatermarkImageAsset | null> {
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
        throw httpError.badRequest("Bật watermark text thì phải có nội dung textContent");
    }
    if (imageEnabled && !imageAssetId) {
        throw httpError.badRequest("Bật watermark ảnh thì phải chọn imageAssetId");
    }
}

export const WatermarkConfigService = {
    async listImages(): Promise<WatermarkImageRecord[]> {
        const rows = await db.query.watermarkImageAssets.findMany({
            orderBy: [desc(watermarkImageAssets.createdAt)],
            limit: 200,
        });
        return rows.map(mapImage);
    },

    async uploadImage(input: WatermarkUploadImageInput): Promise<WatermarkImageRecord> {
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
        const canonicalKey = buildWatermarkOriginalKey(assetId, validated.extension);
        const bucket = resolveS3Bucket();

        await s3.getMinIOClient().putObject(
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

        const [asset] = await db.insert(watermarkImageAssets).values({
            id: assetId,
            storageKey: canonicalKey,
            rasterStorageKey,
            mimeType: validated.mimeType,
            fileSizeBytes: validated.bytes.byteLength,
            originalFilename: storedFilename,
            sha256: hash,
            status: "active",
            uploadedById: input.actorId,
        }).returning();

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

        const [{ value: usageCount }] = await db
            .select({ value: count() })
            .from(watermarkPlacements)
            .where(eq(watermarkPlacements.imageAssetId, asset.id));

        if (Number(usageCount) > 0) {
            throw httpError.badRequest(
                `Ảnh đang được dùng bởi ${usageCount} cấu hình placement — hãy gỡ hoặc đổi ảnh trên placement trước`,
            );
        }

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

        await db.delete(watermarkImageAssets).where(eq(watermarkImageAssets.id, asset.id));
        return { deleted: true };
    },

    async listPlacements(): Promise<WatermarkPlacementRecord[]> {
        const rows = await db.query.watermarkPlacements.findMany({
            orderBy: [desc(watermarkPlacements.createdAt)],
            with: { imageAsset: true },
        });
        return rows.map((row) => mapPlacement(row, row.imageAsset ?? null));
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

        const imageAssetId = input.imageAssetId === undefined
            ? null
            : (input.imageAssetId?.trim() || null);
        if (imageAssetId) {
            const asset = await loadAsset(imageAssetId);
            if (!asset) {
                throw httpError.badRequest("imageAssetId không tồn tại");
            }
        }

        const textEnabled = input.textEnabled ?? false;
        const textContent = input.textContent === undefined
            ? null
            : (input.textContent?.trim() || null);
        const imageEnabled = input.imageEnabled ?? false;

        assertPlacementContent(textEnabled, textContent, imageEnabled, imageAssetId);

        if (input.textOpacity !== undefined) assertOpacity(input.textOpacity, "textOpacity");
        if (input.imageOpacity !== undefined) assertOpacity(input.imageOpacity, "imageOpacity");
        if (input.textSizePercent !== undefined) {
            assertSizePercent(input.textSizePercent, "textSizePercent");
        }
        if (input.imageSizePercent !== undefined) {
            assertSizePercent(input.imageSizePercent, "imageSizePercent");
        }

        const [created] = await db.insert(watermarkPlacements).values({
            name,
            imageAssetId,
            imageEnabled,
            imageOpacity: input.imageOpacity ?? 30,
            imagePosition: input.imagePosition
                ? assertPosition(input.imagePosition, "imagePosition")
                : "center",
            imageSizePercent: input.imageSizePercent ?? 30,
            textEnabled,
            textContent,
            textOpacity: input.textOpacity ?? 30,
            textPosition: input.textPosition
                ? assertPosition(input.textPosition, "textPosition")
                : "center",
            textSizePercent: input.textSizePercent ?? 20,
            updatedById: actorId,
            updatedAt: new Date(),
        }).returning();

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
        if (input.imageEnabled !== undefined) patch.imageEnabled = input.imageEnabled;
        if (input.imageOpacity !== undefined) {
            assertOpacity(input.imageOpacity, "imageOpacity");
            patch.imageOpacity = input.imageOpacity;
        }
        if (input.imagePosition !== undefined) {
            patch.imagePosition = assertPosition(input.imagePosition, "imagePosition");
        }
        if (input.imageSizePercent !== undefined) {
            assertSizePercent(input.imageSizePercent, "imageSizePercent");
            patch.imageSizePercent = input.imageSizePercent;
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

        const nextTextEnabled = patch.textEnabled ?? current.textEnabled;
        const nextTextContent = patch.textContent !== undefined
            ? patch.textContent
            : current.textContent;
        const nextImageEnabled = patch.imageEnabled ?? current.imageEnabled;
        const nextImageAssetId = patch.imageAssetId !== undefined
            ? patch.imageAssetId
            : current.imageAssetId;

        assertPlacementContent(
            nextTextEnabled,
            nextTextContent,
            nextImageEnabled,
            nextImageAssetId,
        );

        const [updated] = await db.update(watermarkPlacements)
            .set(patch)
            .where(eq(watermarkPlacements.id, current.id))
            .returning();

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
        await db.delete(watermarkPlacements).where(eq(watermarkPlacements.id, id));
        return { deleted: true };
    },
};
