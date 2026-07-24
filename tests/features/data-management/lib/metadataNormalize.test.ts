import { describe, expect, it } from 'vitest'

import { mergeMetadataFieldChanges } from '@/features/data-management/lib/metadataHelpers'
import {
  collapseTaiLieuDocuments,
  expandTaiLieuDocuments,
} from '@/features/data-management/lib/metadataNormalize'
import type { DataDossierMetadataT } from '@/features/data-management/types'

const baseMetadata: DataDossierMetadataT = {
  ho_so_id: '218_CD',
  metadata_groups: [
    {
      group_code: 'PHONG_LUU_TRU',
      group_name: 'Metadata cap Phong',
      source_document: { file_name: 'phong.pdf', file_path: 'raw/phong.pdf' },
      fields: [
        {
          name: 'MA_PHONG',
          display: 'Ma phong',
          type: 'string',
          value: 'A',
          page: 1,
          bboxes: [],
        },
      ],
    },
    {
      group_code: 'TAI_LIEU_LUU_TRU',
      group_name: 'Metadata cap Tai lieu',
      documents: [
        {
          source_document: {
            file_name: 'doc1.pdf',
            file_path: 'raw/doc1.pdf',
          },
          fields: [
            {
              name: 'TEN_LOAI_TAI_LIEU',
              display: 'Ten loai',
              type: 'string',
              value: 'Quyet dinh',
              page: 1,
              bboxes: [],
            },
            {
              name: 'TRICH_YEU_NOI_DUNG',
              display: 'Trich yeu',
              type: 'string',
              value: 'Doc 1',
              page: 1,
              bboxes: [],
            },
          ],
        },
        {
          source_document: {
            file_name: 'doc2.pdf',
            file_path: 'raw/doc2.pdf',
          },
          fields: [
            {
              name: 'TEN_LOAI_TAI_LIEU',
              display: 'Ten loai',
              type: 'string',
              value: 'Bien lai',
              page: 1,
              bboxes: [],
            },
            {
              name: 'TRICH_YEU_NOI_DUNG',
              display: 'Trich yeu',
              type: 'string',
              value: 'Doc 2',
              page: 1,
              bboxes: [],
            },
          ],
        },
      ],
      fields: [],
    },
  ],
}

describe('metadataNormalize', () => {
  it('expands and collapses TT05 documents[]', () => {
    const expanded = expandTaiLieuDocuments(baseMetadata)
    expect(expanded.metadata_groups).toHaveLength(3)
    expect(
      expanded.metadata_groups.filter(
        (group) => group.group_code === 'TAI_LIEU_LUU_TRU',
      ),
    ).toHaveLength(2)

    const collapsed = collapseTaiLieuDocuments(expanded)
    expect(collapsed.metadata_groups).toHaveLength(2)
    expect(collapsed.metadata_groups[1]?.documents).toHaveLength(2)
  })

  it('mergeMetadataFieldChanges updates matching document only', () => {
    const expanded = expandTaiLieuDocuments(baseMetadata)
    const edited = structuredClone(expanded)
    const doc2 = edited.metadata_groups[2]
    const trichYeu = doc2?.fields.find(
      (field) => field.name === 'TRICH_YEU_NOI_DUNG',
    )
    if (!trichYeu) throw new Error('missing field')
    trichYeu.value = 'Doc 2 edited'

    const merged = mergeMetadataFieldChanges(expanded, edited)
    const mergedDoc1 = merged.metadata_groups[1]
    const mergedDoc2 = merged.metadata_groups[2]

    expect(
      mergedDoc1?.fields.find((field) => field.name === 'TRICH_YEU_NOI_DUNG')
        ?.value,
    ).toBe('Doc 1')
    expect(
      mergedDoc2?.fields.find((field) => field.name === 'TRICH_YEU_NOI_DUNG')
        ?.value,
    ).toBe('Doc 2 edited')
  })
})
