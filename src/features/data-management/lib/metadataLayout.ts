import type { DataMetadataGroupT } from '@/features/data-management/types'

export const HO_SO_LUU_TRU_GROUP_CODE = 'HO_SO_LUU_TRU'
export const TAI_LIEU_LUU_TRU_GROUP_CODE = 'TAI_LIEU_LUU_TRU'

const ARCHIVAL_GROUP_CODES = new Set([
  HO_SO_LUU_TRU_GROUP_CODE,
  TAI_LIEU_LUU_TRU_GROUP_CODE,
])

export type MetadataGroupEntry = {
  group: DataMetadataGroupT
  groupIndex: number
}

export type MetadataDisplayLayout =
  | {
      layout: 'tt05'
      hoSoEntry: MetadataGroupEntry | null
      taiLieuEntries: Array<MetadataGroupEntry>
      legacyEntries: Array<MetadataGroupEntry>
    }
  | {
      layout: 'legacy'
      hoSoEntry: null
      taiLieuEntries: []
      legacyEntries: Array<MetadataGroupEntry>
    }

export function isTt05StyleMetadata(
  groups: Array<DataMetadataGroupT>,
): boolean {
  return groups.some((group) => ARCHIVAL_GROUP_CODES.has(group.group_code))
}

export function partitionMetadataGroupsForDisplay(
  groups: Array<DataMetadataGroupT>,
): MetadataDisplayLayout {
  const entries: Array<MetadataGroupEntry> = groups.map((group, groupIndex) => ({
    group,
    groupIndex,
  }))

  if (!isTt05StyleMetadata(groups)) {
    return {
      layout: 'legacy',
      hoSoEntry: null,
      taiLieuEntries: [],
      legacyEntries: entries,
    }
  }

  return {
    layout: 'tt05',
    hoSoEntry:
      entries.find(
        (entry) => entry.group.group_code === HO_SO_LUU_TRU_GROUP_CODE,
      ) ?? null,
    taiLieuEntries: entries.filter(
      (entry) => entry.group.group_code === TAI_LIEU_LUU_TRU_GROUP_CODE,
    ),
    legacyEntries: entries.filter(
      (entry) => !ARCHIVAL_GROUP_CODES.has(entry.group.group_code),
    ),
  }
}

export function getTaiLieuDocumentDisplayTitle(
  group: DataMetadataGroupT,
): string | null {
  const tenLoai = group.fields.find(
    (field) => field.name.trim().toUpperCase() === 'TEN_LOAI_TAI_LIEU',
  )
  const label = tenLoai?.value?.trim()
  if (label) return label

  const fileName = group.source_document?.file_name?.trim()
  return fileName || null
}

export function resolveDefaultMetadataGroupIndex(
  groups: Array<DataMetadataGroupT>,
): number {
  const partition = partitionMetadataGroupsForDisplay(groups)
  if (partition.layout === 'legacy') {
    return groups.length > 0 ? 0 : -1
  }
  if (partition.hoSoEntry) return partition.hoSoEntry.groupIndex
  if (partition.taiLieuEntries[0]) return partition.taiLieuEntries[0].groupIndex
  if (partition.legacyEntries[0]) return partition.legacyEntries[0].groupIndex
  return -1
}

export function countVisibleMetadataGroups(
  partition: MetadataDisplayLayout,
): number {
  return (
    (partition.hoSoEntry ? 1 : 0) +
    partition.taiLieuEntries.length +
    partition.legacyEntries.length
  )
}
