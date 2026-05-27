import type {
  DataDossierMetadataT,
  DataRecordInfoFieldT,
} from '@/features/data-management/types'

export function buildRecordInfoFields(
  metadata: DataDossierMetadataT,
): Array<DataRecordInfoFieldT> {
  const items: Array<DataRecordInfoFieldT> = []

  if (metadata.ho_so_id) {
    items.push({ name: 'ho_so_id', value: metadata.ho_so_id })
  }
  if (metadata.trang_thai_ho_so) {
    items.push({ name: 'trang_thai_ho_so', value: metadata.trang_thai_ho_so })
  }

  for (const field of metadata.general_fields ?? []) {
    items.push({ name: field.name, value: field.value })
  }

  return items
}
