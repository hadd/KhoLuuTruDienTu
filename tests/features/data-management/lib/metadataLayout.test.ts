import { describe, expect, it } from 'vitest'

import {
  countVisibleMetadataGroups,
  getTaiLieuDocumentDisplayTitle,
  partitionMetadataGroupsForDisplay,
} from '@/features/data-management/lib/metadataLayout'
import type { DataMetadataGroupT } from '@/features/data-management/types'

const tt05Groups: Array<DataMetadataGroupT> = [
  {
    group_code: 'PHONG_LUU_TRU',
    group_name: 'Metadata cap Phong',
    fields: [{ name: 'MA_PHONG', display: 'Ma phong', type: 'string', value: 'A', page: 1, bboxes: [] }],
  },
  {
    group_code: 'HO_SO_LUU_TRU',
    group_name: 'Metadata cap Ho so',
    fields: [{ name: 'MA_HO_SO', display: 'Ma ho so', type: 'string', value: 'HS-1', page: 1, bboxes: [] }],
  },
  {
    group_code: 'TAI_LIEU_LUU_TRU',
    group_name: 'Tai lieu 1',
    source_document: { file_name: 'doc1.pdf', file_path: 'raw/doc1.pdf' },
    fields: [
      {
        name: 'TEN_LOAI_TAI_LIEU',
        display: 'Ten loai',
        type: 'string',
        value: 'Quyet dinh',
        page: 1,
        bboxes: [],
      },
    ],
  },
]

describe('metadataLayout', () => {
  it('partitions TT05 groups and hides phong from visible sections', () => {
    const partition = partitionMetadataGroupsForDisplay(tt05Groups)

    expect(partition.layout).toBe('tt05')
    expect(partition.hoSoEntry?.groupIndex).toBe(1)
    expect(partition.taiLieuEntries).toHaveLength(1)
    expect(partition.legacyEntries).toHaveLength(0)
    expect(countVisibleMetadataGroups(partition)).toBe(2)
  })

  it('uses TEN_LOAI_TAI_LIEU as document card title', () => {
    expect(getTaiLieuDocumentDisplayTitle(tt05Groups[2]!)).toBe('Quyet dinh')
  })

  it('keeps legacy metadata as flat list', () => {
    const legacyGroups: Array<DataMetadataGroupT> = [
      {
        group_code: 'QUYET_DINH',
        group_name: 'Quyet dinh',
        fields: [],
      },
    ]
    const partition = partitionMetadataGroupsForDisplay(legacyGroups)

    expect(partition.layout).toBe('legacy')
    expect(partition.legacyEntries).toHaveLength(1)
    expect(countVisibleMetadataGroups(partition)).toBe(1)
  })
})
