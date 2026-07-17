export type WatermarkPositionT =
  | 'center'
  | 'top_left'
  | 'top_right'
  | 'bottom_left'
  | 'bottom_right'
  | 'tile_grid'
  | 'custom'

export interface WatermarkStampT {
  offsetXPercent: number
  offsetYPercent: number
  rotationDegrees?: number
}

export interface WatermarkImageRecordT {
  id: string
  storageKey: string
  rasterStorageKey: string | null
  mimeType: string
  fileSizeBytes: number
  originalFilename: string
  sha256: string
  status: string
  uploadedById: string | null
  createdAt: string
}

export interface WatermarkPlacementSummaryT {
  id: string
  name: string
  isActive: boolean
  imageEnabled: boolean
  imagePosition: WatermarkPositionT | string
  imageAssetId: string | null
  imageAssetName: string | null
  textEnabled: boolean
  textContent: string | null
  textPosition: WatermarkPositionT | string
  updatedAt: string
  createdAt: string
}

export interface WatermarkPlacementRecordT {
  id: string
  name: string
  isActive: boolean
  imageAssetId: string | null
  imageEnabled: boolean
  imageOpacity: number
  imagePosition: WatermarkPositionT | string
  imageSizePercent: number
  imageOffsetXPercent: number | null
  imageOffsetYPercent: number | null
  imageRotationDegrees: number
  imageStamps: Array<WatermarkStampT> | null
  textEnabled: boolean
  textContent: string | null
  textOpacity: number
  textPosition: WatermarkPositionT | string
  textSizePercent: number
  textOffsetXPercent: number | null
  textOffsetYPercent: number | null
  textRotationDegrees: number
  textStamps: Array<WatermarkStampT> | null
  imageAsset: WatermarkImageRecordT | null
  updatedById: string | null
  updatedAt: string
  createdAt: string
}

export interface WatermarkPlacementPayloadT {
  name: string
  imageAssetId?: string | null
  imageEnabled?: boolean
  imageOpacity?: number
  imagePosition?: WatermarkPositionT
  imageSizePercent?: number
  imageOffsetXPercent?: number | null
  imageOffsetYPercent?: number | null
  imageRotationDegrees?: number
  imageStamps?: Array<WatermarkStampT> | null
  textEnabled?: boolean
  textContent?: string | null
  textOpacity?: number
  textPosition?: WatermarkPositionT
  textSizePercent?: number
  textOffsetXPercent?: number | null
  textOffsetYPercent?: number | null
  textRotationDegrees?: number
  textStamps?: Array<WatermarkStampT> | null
}

export type CreateWatermarkPlacementPayloadT = WatermarkPlacementPayloadT

export type UpdateWatermarkPlacementPayloadT =
  Partial<WatermarkPlacementPayloadT>

export interface WatermarkPdfSecurityT {
  enabled: boolean
  allowPrinting: boolean
  allowChanging: boolean
  allowDocumentAssembly: boolean
  allowContentCopying: boolean
  allowContentCopyingAccessibility: boolean
  allowPageExtraction: boolean
  allowCommenting: boolean
  allowFormFilling: boolean
  allowSigning: boolean
  updatedAt: string | null
  updatedById: string | null
}

export type UpdateWatermarkPdfSecurityPayloadT = Partial<
  Omit<WatermarkPdfSecurityT, 'updatedAt' | 'updatedById'>
>
