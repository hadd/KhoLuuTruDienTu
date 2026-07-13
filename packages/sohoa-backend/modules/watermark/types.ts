import type { WatermarkPosition } from "../../db/schemas/watermark.ts";

export type WatermarkImageRecord = {
    id: string;
    storageKey: string;
    rasterStorageKey: string | null;
    mimeType: string;
    fileSizeBytes: number;
    originalFilename: string;
    sha256: string;
    status: string;
    uploadedById: string | null;
    createdAt: Date;
};

export type WatermarkPlacementInput = {
    name?: string;
    imageAssetId?: string | null;
    imageEnabled?: boolean;
    imageOpacity?: number;
    imagePosition?: WatermarkPosition;
    imageSizePercent?: number;
    textEnabled?: boolean;
    textContent?: string | null;
    textOpacity?: number;
    textPosition?: WatermarkPosition;
    textSizePercent?: number;
};

export type WatermarkPlacementRecord = {
    id: string;
    name: string;
    imageAssetId: string | null;
    imageEnabled: boolean;
    imageOpacity: number;
    imagePosition: string;
    imageSizePercent: number;
    textEnabled: boolean;
    textContent: string | null;
    textOpacity: number;
    textPosition: string;
    textSizePercent: number;
    imageAsset: WatermarkImageRecord | null;
    updatedById: string | null;
    updatedAt: Date;
    createdAt: Date;
};

export type WatermarkUploadImageInput = {
    file: File;
    actorId: string;
};
