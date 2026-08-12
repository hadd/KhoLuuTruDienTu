import { describe, expect, it } from 'vitest'

import {
  hasWarehouseMetadataFieldSearch,
  highlightSearchQuery,
  resolveWarehouseMetadataSearchLines,
} from '@/features/archive-warehouse/lib/warehouseMetadataSearchDisplay'
import type { ArchiveWarehouseSearchHitT } from '@/features/archive-warehouse/types'

function baseHit(
  overrides: Partial<ArchiveWarehouseSearchHitT> = {},
): ArchiveWarehouseSearchHitT {
  return {
    entityType: 'dossier',
    entityId: 'dossier-1',
    title: 'Hồ sơ A',
    fondId: 'fond-1',
    fondName: 'Phông A',
    score: 1,
    metadata: {},
    ...overrides,
  }
}

describe('warehouseMetadataSearchDisplay', () => {
  it('detects metadata field search mode', () => {
    expect(hasWarehouseMetadataFieldSearch(undefined)).toBe(false)
    expect(hasWarehouseMetadataFieldSearch(['TRICH_YEU_NOI_DUNG'])).toBe(true)
  })

  it('formats nested TT05 match as label: value', () => {
    const lines = resolveWarehouseMetadataSearchLines(
      baseHit({
        matches: [
          {
            groupCode: 'VB',
            groupName: 'Văn bản',
            name: 'TRICH_YEU_NOI_DUNG',
            display: 'Trích yếu nội dung',
            value: 'Quyết định thi hành án',
            fileName: 'doc.pdf',
            filePath: null,
            page: 2,
            bbox: null,
            highlight: 'Quyết định <mark>thi hành án</mark>',
          },
        ],
      }),
      ['TRICH_YEU_NOI_DUNG'],
      'thi hành án',
    )

    expect(lines).toHaveLength(1)
    expect(lines[0]?.label).toBe('Trích yếu nội dung')
    expect(lines[0]?.valueHtml).toContain('<mark>thi hành án</mark>')
    expect(lines[0]?.fileName).toBe('doc.pdf')
  })

  it('returns only selected fields when multiple matches exist', () => {
    const lines = resolveWarehouseMetadataSearchLines(
      baseHit({
        matches: [
          {
            groupCode: 'VB',
            groupName: 'Văn bản',
            name: 'TRICH_YEU_NOI_DUNG',
            display: 'Trích yếu nội dung',
            value: 'A',
            fileName: null,
            filePath: null,
            page: null,
            bbox: null,
            highlight: 'A',
          },
          {
            groupCode: 'VB',
            groupName: 'Văn bản',
            name: 'NGON_NGU',
            display: 'Ngôn ngữ',
            value: 'Việt',
            fileName: null,
            filePath: null,
            page: null,
            bbox: null,
            highlight: 'Việt',
          },
        ],
      }),
      ['NGON_NGU'],
      'Việt',
    )

    expect(lines).toHaveLength(1)
    expect(lines[0]?.label).toBe('Ngôn ngữ')
    expect(lines[0]?.valueHtml).toBe('<mark>Việt</mark>')
  })

  it('maps catalog fields from hit properties', () => {
    const lines = resolveWarehouseMetadataSearchLines(
      baseHit({
        hoSoId: 'HS-001',
        title: 'Hồ sơ thi hành án',
      }),
      ['MA_HO_SO', 'TIEU_DE_HO_SO'],
    )

    expect(lines).toEqual([
      {
        fieldKey: 'MA_HO_SO',
        label: 'Mã hồ sơ',
        valueHtml: 'HS-001',
      },
      {
        fieldKey: 'TIEU_DE_HO_SO',
        label: 'Tiêu đề hồ sơ',
        valueHtml: 'Hồ sơ thi hành án',
      },
    ])
  })

  it('filters document type names by search query instead of listing all', () => {
    const lines = resolveWarehouseMetadataSearchLines(
      baseHit({
        documentTypeNames: [
          'Bản án, quyết định',
          'Biên lai',
          'Đương sự',
          'Thi hành xong (Biên lai)',
        ],
      }),
      ['TEN_LOAI_TAI_LIEU'],
      'biên lai',
    )

    expect(lines).toHaveLength(1)
    expect(lines[0]?.label).toBe('Tên loại tài liệu')
    expect(lines[0]?.valueHtml).toBe(
      '<mark>Biên lai</mark>, Thi hành xong (<mark>Biên lai</mark>)',
    )
  })

  it('prefers nested matches over full document type catalog list', () => {
    const lines = resolveWarehouseMetadataSearchLines(
      baseHit({
        documentTypeNames: ['Biên lai', 'Đương sự', 'Bản án'],
        matches: [
          {
            groupCode: 'VB',
            groupName: 'Văn bản',
            name: 'TEN_LOAI_TAI_LIEU',
            display: 'Tên loại tài liệu',
            value: 'Biên lai',
            fileName: null,
            filePath: null,
            page: null,
            bbox: null,
            highlight: 'Biên lai',
          },
        ],
      }),
      ['TEN_LOAI_TAI_LIEU'],
      'biên lai',
    )

    expect(lines).toHaveLength(1)
    expect(lines[0]?.valueHtml).toBe('<mark>Biên lai</mark>')
  })

  it('highlights plain search terms', () => {
    expect(highlightSearchQuery('Thi hành xong (Biên lai)', 'biên lai')).toBe(
      'Thi hành xong (<mark>Biên lai</mark>)',
    )
  })
})
