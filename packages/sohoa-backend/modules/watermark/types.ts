import type { WatermarkPosition } from "../../db/schemas/watermark.ts";

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

export type WatermarkActiveImageAsset = {
    id: string;
    storageKey: string;
    mimeType: string;
    originalFilename: string;
    fileSizeBytes: number;
    status: string;
    createdAt: Date;
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
    activeImageAsset: WatermarkActiveImageAsset | null;
    updatedById: string | null;
    updatedAt: Date;
    createdAt: Date;
};

export type WatermarkUploadImageInput = {
    file: File;
    actorId: string;
};

export type WatermarkImageHistoryItem = {
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
