import { describe, expect, it } from 'vitest'

import { mergeMetadataFieldChanges } from '@/features/data-management/lib/metadataHelpers'
import {
  collapseTaiLieuDocuments,
  ensureHoSoFondField,
  expandTaiLieuDocuments,
  HO_SO_FOND_FIELD,
  HO_SO_LUU_TRU_GROUP_CODE,
  migrateTt05MetadataLayout,
} from '@/features/data-management/lib/metadataNormalize'
import type { DataDossierMetadataT } from '@/features/data-management/types'

const baseMetadata: DataDossierMetadataT = {
  ho_so_id: '218_CD',
  metadata_groups: [
    {
      group_code: 'HO_SO_LUU_TRU',
      group_name: 'Metadata cap Ho so',
      source_document: { file_name: 'bia.pdf', file_path: 'raw/bia.pdf' },
      fields: [
        {
          name: 'FOND',
          display: 'Phong luu tru',
          type: 'string',
          value: 'Phong A',
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

  it('migrateTt05MetadataLayout moves fond from legacy PHONG group', () => {
    const migrated = migrateTt05MetadataLayout({
      metadata_groups: [
        {
          group_code: 'PHONG_LUU_TRU',
          group_name: 'Phong',
          fields: [
            {
              name: 'TEN_PHONG',
              display: 'Ten phong',
              type: 'string',
              value: 'Phong A',
              page: 1,
              bboxes: [],
            },
          ],
        },
        {
          group_code: HO_SO_LUU_TRU_GROUP_CODE,
          group_name: 'Ho so',
          fields: [],
        },
      ],
    })

    expect(
      migrated.metadata_groups.some(
        (group) => group.group_code === 'PHONG_LUU_TRU',
      ),
    ).toBe(false)
    expect(
      migrated.metadata_groups[0]?.fields.find(
        (field) => field.name === HO_SO_FOND_FIELD,
      )?.value,
    ).toBe('Phong A')
  })

  it('migrateTt05MetadataLayout renames legacy PHONG_LUU_TRU field in HO_SO', () => {
    const migrated = migrateTt05MetadataLayout({
      metadata_groups: [
        {
          group_code: HO_SO_LUU_TRU_GROUP_CODE,
          group_name: 'Ho so',
          fields: [
            {
              name: 'PHONG_LUU_TRU',
              display: 'Phong',
              type: 'string',
              value: 'Phong legacy field',
              page: 1,
              bboxes: [],
            },
          ],
        },
      ],
    })

    const hoSoGroup = migrated.metadata_groups.find(
      (group) => group.group_code === HO_SO_LUU_TRU_GROUP_CODE,
    )
    expect(
      hoSoGroup?.fields.some((field) => field.name === 'PHONG_LUU_TRU'),
    ).toBe(false)
    expect(
      hoSoGroup?.fields.find((field) => field.name === HO_SO_FOND_FIELD)?.value,
    ).toBe('Phong legacy field')
  })

  it('ensureHoSoFondField keeps existing fond value over dossier fondId', () => {
    const ensured = ensureHoSoFondField(baseMetadata, 'fond-123')
    const fondValue = ensured.metadata_groups
      .find((group) => group.group_code === HO_SO_LUU_TRU_GROUP_CODE)
      ?.fields.find((field) => field.name === HO_SO_FOND_FIELD)?.value

    expect(fondValue).toBe('Phong A')
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
