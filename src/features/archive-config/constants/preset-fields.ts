import type { ArchiveFieldTypeT, ArchiveReferenceSourceT } from '@/features/archive-config/types'

export type ArchivePresetFieldT = {
  fieldKey: string
  label: string
  fieldType: ArchiveFieldTypeT
  referenceSource: ArchiveReferenceSourceT
  dependsOnFieldKey?: string | null
}

export const ARCHIVE_PRESET_FIELDS: Array<ArchivePresetFieldT> = [
  {
    fieldKey: 'fond',
    label: 'Phông lưu trữ',
    fieldType: 'REFERENCE',
    referenceSource: 'FOND',
  },
  {
    fieldKey: 'inventory',
    label: 'Mục lục',
    fieldType: 'REFERENCE',
    referenceSource: 'INVENTORY',
    dependsOnFieldKey: 'fond',
  },
  {
    fieldKey: 'dossier_type',
    label: 'Loại hồ sơ',
    fieldType: 'REFERENCE',
    referenceSource: 'DOSSIER_TYPE',
  },
  {
    fieldKey: 'retention_period',
    label: 'Thời hạn lưu trữ',
    fieldType: 'REFERENCE',
    referenceSource: 'RETENTION_PERIOD',
  },
  {
    fieldKey: 'physical_location',
    label: 'Vị trí kho vật lý',
    fieldType: 'REFERENCE',
    referenceSource: 'PHYSICAL_BOTTOM_ITEM',
  },
]

export const ARCHIVE_PRESET_FIELD_KEYS = new Set(
  ARCHIVE_PRESET_FIELDS.map((field) => field.fieldKey),
)
