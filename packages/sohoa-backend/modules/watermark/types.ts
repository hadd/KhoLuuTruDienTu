import type {
  WatermarkPosition,
  WatermarkStamp,
} from "../../db/schemas/watermark.ts";

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
  imageOffsetXPercent?: number | null;
  imageOffsetYPercent?: number | null;
  imageRotationDegrees?: number;
  imageStamps?: WatermarkStamp[] | null;
  textEnabled?: boolean;
  textContent?: string | null;
  textOpacity?: number;
  textPosition?: WatermarkPosition;
  textSizePercent?: number;
  textOffsetXPercent?: number | null;
  textOffsetYPercent?: number | null;
  textRotationDegrees?: number;
  textStamps?: WatermarkStamp[] | null;
};

/** Full placement — GET /placements/:id, create/update response */
export type WatermarkPlacementRecord = {
  id: string;
  name: string;
  isActive: boolean;
  imageAssetId: string | null;
  imageEnabled: boolean;
  imageOpacity: number;
  imagePosition: string;
  imageSizePercent: number;
  imageOffsetXPercent: number | null;
  imageOffsetYPercent: number | null;
  imageRotationDegrees: number;
  imageStamps: WatermarkStamp[] | null;
  textEnabled: boolean;
  textContent: string | null;
  textOpacity: number;
  textPosition: string;
  textSizePercent: number;
  textOffsetXPercent: number | null;
  textOffsetYPercent: number | null;
  textRotationDegrees: number;
  textStamps: WatermarkStamp[] | null;
  imageAsset: WatermarkImageRecord | null;
  updatedById: string | null;
  updatedAt: Date;
  createdAt: Date;
};

/** Compact list item — GET /placements */
export type WatermarkPlacementSummary = {
  id: string;
  name: string;
  isActive: boolean;
  imageEnabled: boolean;
  imagePosition: string;
  imageAssetId: string | null;
  imageAssetName: string | null;
  textEnabled: boolean;
  textContent: string | null;
  textPosition: string;
  updatedAt: Date;
  createdAt: Date;
};

export type WatermarkUploadImageInput = {
  file: File;
  actorId: string;
};

/** Shared PDF Document Restrictions (all placements). */
export type WatermarkPdfSecurityRecord = {
  enabled: boolean;
  allowPrinting: boolean;
  allowChanging: boolean;
  allowDocumentAssembly: boolean;
  allowContentCopying: boolean;
  allowContentCopyingAccessibility: boolean;
  allowPageExtraction: boolean;
  allowCommenting: boolean;
  allowFormFilling: boolean;
  allowSigning: boolean;
  updatedAt: Date | null;
  updatedById: string | null;
};

export type WatermarkPdfSecurityInput = {
  enabled?: boolean;
  allowPrinting?: boolean;
  allowChanging?: boolean;
  allowDocumentAssembly?: boolean;
  allowContentCopying?: boolean;
  allowContentCopyingAccessibility?: boolean;
  allowPageExtraction?: boolean;
  allowCommenting?: boolean;
  allowFormFilling?: boolean;
  allowSigning?: boolean;
};
