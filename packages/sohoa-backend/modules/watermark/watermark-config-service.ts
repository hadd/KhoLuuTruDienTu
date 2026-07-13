import { httpError } from "@shared/common-lib";
import { and, desc, eq, ne } from "drizzle-orm";
import { Buffer } from "node:buffer";
import { db } from "../../db/db-conn.ts";
import {
    WATERMARK_POSITION_VALUES,
    watermarkConfigs,
    watermarkImageAssets,
    type WatermarkConfig,
    type WatermarkImageAsset,
    type WatermarkPosition,
} from "../../db/schemas/watermark.ts";
import { env } from "../../env.ts";
import { getS3Client } from "../../libs/s3.ts";
import {
    buildWatermarkOriginalKey,
    getWatermarkImageMaxBytes,
} from "../../libs/watermark/watermark-storage-keys.ts";
import { validateWatermarkImageBytes } from "../../libs/watermark/watermark-image-validator.ts";

export type WatermarkConfigInput = {
    textEnabled?: boolean;
    textContent?: string | null;
    textOpacity?: number;
    textPosition?: WatermarkPosition;
    textSizePercent?: number;
    imageEnabled?: boolean;
    imageOpacity?: number;
    imagePosition?: WatermarkPosition;
    imageSizePercent?: number;
};

export type WatermarkConfigRecord = {
    id: string;
    textEnabled: boolean;
    textContent: string | null;
    textOpacity: number;
    textPosition: string;
    textSizePercent: number;
    imageEnabled: boolean;
    imageOpacity: number;
    imagePosition: string;
    imageSizePercent: number;
    activeImageAssetId: string | null;
    activeImageAsset: {
        id: string;
        storageKey: string;
        mimeType: string;
        originalFilename: string;
        fileSizeBytes: number;
        status: string;
        createdAt: Date;
    } | null;
    updatedById: string | null;
    updatedAt: Date;
    createdAt: Date;
};

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

function mapConfig(
    row: WatermarkConfig,
    asset: WatermarkImageAsset | null = null,
): WatermarkConfigRecord {
    return {
        id: row.id,
        textEnabled: row.textEnabled,
        textContent: row.textContent,
        textOpacity: row.textOpacity,
        textPosition: row.textPosition,
        textSizePercent: row.textSizePercent,
        imageEnabled: row.imageEnabled,
        imageOpacity: row.imageOpacity,
        imagePosition: row.imagePosition,
        imageSizePercent: row.imageSizePercent,
        activeImageAssetId: row.activeImageAssetId,
        activeImageAsset: asset
            ? {
                id: asset.id,
                storageKey: asset.storageKey,
                mimeType: asset.mimeType,
                originalFilename: asset.originalFilename,
                fileSizeBytes: asset.fileSizeBytes,
                status: asset.status,
                createdAt: asset.createdAt,
            }
            : null,
        updatedById: row.updatedById,
        updatedAt: row.updatedAt,
        createdAt: row.createdAt,
    };
}

async function loadActiveAsset(assetId: string | null): Promise<WatermarkImageAsset | null> {
    if (!assetId) return null;
    const asset = await db.query.watermarkImageAssets.findFirst({
        where: eq(watermarkImageAssets.id, assetId),
    });
    return asset ?? null;
}

async function ensureConfigRow(): Promise<WatermarkConfig> {
    const existing = await db.query.watermarkConfigs.findFirst({
        orderBy: (table, { asc }) => [asc(table.createdAt)],
    });
    if (existing) return existing;

    const [created] = await db.insert(watermarkConfigs).values({}).returning();
    return created;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
    const copy = new Uint8Array(bytes);
    const digest = await crypto.subtle.digest("SHA-256", copy);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

export const WatermarkConfigService = {
    async get(): Promise<WatermarkConfigRecord> {
        const row = await ensureConfigRow();
        const asset = await loadActiveAsset(row.activeImageAssetId);
        return mapConfig(row, asset);
    },

    async update(input: WatermarkConfigInput, actorId: string): Promise<WatermarkConfigRecord> {
        const current = await ensureConfigRow();

        const patch: Partial<typeof watermarkConfigs.$inferInsert> = {
            updatedById: actorId,
            updatedAt: new Date(),
        };

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

        const nextTextEnabled = patch.textEnabled ?? current.textEnabled;
        const nextTextContent = patch.textContent !== undefined
            ? patch.textContent
            : current.textContent;
        if (nextTextEnabled && !nextTextContent?.trim()) {
            throw httpError.badRequest("Bật watermark text thì phải có nội dung textContent");
        }

        const nextImageEnabled = patch.imageEnabled ?? current.imageEnabled;
        const nextAssetId = current.activeImageAssetId;
        if (nextImageEnabled && !nextAssetId) {
            throw httpError.badRequest("Bật watermark ảnh thì phải tải ảnh lên trước");
        }

        const [updated] = await db.update(watermarkConfigs)
            .set(patch)
            .where(eq(watermarkConfigs.id, current.id))
            .returning();

        const asset = await loadActiveAsset(updated.activeImageAssetId);
        return mapConfig(updated, asset);
    },

    async uploadImage(input: {
        file: File;
        actorId: string;
    }): Promise<WatermarkConfigRecord> {
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

        // PNG can be used directly as raster; SVG needs external rasterize (prefer PNG upload).
        const rasterStorageKey = validated.kind === "png" ? canonicalKey : null;
        const config = await ensureConfigRow();
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

        if (config.activeImageAssetId) {
            await db.update(watermarkImageAssets)
                .set({ status: "superseded" })
                .where(and(
                    eq(watermarkImageAssets.id, config.activeImageAssetId),
                    ne(watermarkImageAssets.id, asset.id),
                ));
        }

        const [updated] = await db.update(watermarkConfigs)
            .set({
                activeImageAssetId: asset.id,
                imageEnabled: true,
                updatedById: input.actorId,
                updatedAt: new Date(),
            })
            .where(eq(watermarkConfigs.id, config.id))
            .returning();

        return mapConfig(updated, asset);
    },

    async deleteImage(assetId: string, actorId: string): Promise<WatermarkConfigRecord> {
        const id = assetId.trim();
        const asset = await db.query.watermarkImageAssets.findFirst({
            where: eq(watermarkImageAssets.id, id),
        });
        if (!asset) {
            throw httpError.notFound("Không tìm thấy ảnh watermark");
        }

        const config = await ensureConfigRow();
        const wasActive = config.activeImageAssetId === asset.id;

        if (wasActive) {
            await db.update(watermarkConfigs)
                .set({
                    activeImageAssetId: null,
                    imageEnabled: false,
                    updatedById: actorId,
                    updatedAt: new Date(),
                })
                .where(eq(watermarkConfigs.id, config.id));
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
                    // Object may already be missing; continue hard-delete DB row.
                }
            }
        }

        await db.delete(watermarkImageAssets).where(eq(watermarkImageAssets.id, asset.id));

        const updated = await ensureConfigRow();
        const activeAsset = await loadActiveAsset(updated.activeImageAssetId);
        return mapConfig(updated, activeAsset);
    },

    async listImageHistory() {
        const rows = await db.query.watermarkImageAssets.findMany({
            orderBy: [desc(watermarkImageAssets.createdAt)],
            limit: 100,
        });
        return rows.map((row) => ({
            id: row.id,
            storageKey: row.storageKey,
            rasterStorageKey: row.rasterStorageKey,
            mimeType: row.mimeType,
            fileSizeBytes: row.fileSizeBytes,
            originalFilename: row.originalFilename,
            sha256: row.sha256,
            status: row.status,
            uploadedById: row.uploadedById,
            createdAt: row.createdAt,
        }));
    },
};
