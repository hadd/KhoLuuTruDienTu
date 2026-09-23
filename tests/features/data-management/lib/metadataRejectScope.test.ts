import { describe, expect, it } from 'vitest'

import {
  buildRejectedFieldsSummaryByDocument,
  buildRejectFieldKey,
  resolveMetadataGroupRejectScope,
} from '@/features/data-management/lib/metadataHelpers'
import type { DataDossierMetadataT, DataMetadataGroupT } from '@/features/data-management/types'

describe('metadataRejectScope', () => {
  describe('resolveMetadataGroupRejectScope', () => {
    it('returns unscoped groupCode for HO_SO_LUU_TRU', () => {
      const group: DataMetadataGroupT = {
        group_code: 'HO_SO_LUU_TRU',
        group_name: 'Hồ sơ lưu trữ',
        fields: [],
      }
      expect(resolveMetadataGroupRejectScope(group, 0)).toEqual({
        groupCode: 'HO_SO_LUU_TRU',
      })
    })

    it('returns scoped groupCode with sanitized fileRef from source_document file_name', () => {
      const group: DataMetadataGroupT = {
        group_code: 'TAI_LIEU_LUU_TRU',
        group_name: 'Tài liệu lưu trữ',
        source_document: { file_name: 'Quyết định 01.pdf' },
        fields: [
          {
            name: 'TEN_LOAI_TAI_LIEU',
            display: 'Tên loại',
            type: 'string',
            value: 'Quyết định',
            page: 1,
            bboxes: [],
          },
        ],
      }
      const scope = resolveMetadataGroupRejectScope(group, 1)
      expect(scope.fileRef).toBe('Quy_t___nh_01')
      expect(scope.groupCode).toBe('QUYET_DINH')
    })

    it('falls back to g{groupIndex} when source_document file_name is missing', () => {
      const group: DataMetadataGroupT = {
        group_code: 'TAI_LIEU_LUU_TRU',
        group_name: 'Tài liệu lưu trữ',
        fields: [],
      }
      const scope = resolveMetadataGroupRejectScope(group, 3)
      expect(scope).toEqual({
        groupCode: 'TAI_LIEU_LUU_TRU',
        fileRef: 'g3',
      })
    })
  })

  describe('buildRejectFieldKey', () => {
    it('formats key with fileRef discriminator', () => {
      expect(buildRejectFieldKey('QUYET_DINH', 'SO_KY_HIEU', 'File_1_pdf')).toBe(
        'QUYET_DINH:File_1_pdf.SO_KY_HIEU',
      )
    })

    it('formats key without fileRef', () => {
      expect(buildRejectFieldKey('HO_SO_LUU_TRU', 'TIEU_DE')).toBe(
        'HO_SO_LUU_TRU.TIEU_DE',
      )
    })
  })

  describe('buildRejectedFieldsSummaryByDocument', () => {
    const mockMetadata: DataDossierMetadataT = {
      ho_so_id: 'HS_001',
      metadata_groups: [
        {
          group_code: 'HO_SO_LUU_TRU',
          group_name: 'Metadata Hồ sơ',
          fields: [
            {
              name: 'TIEU_DE',
              display: 'Tiêu đề hồ sơ',
              type: 'string',
              value: 'Hồ sơ tuyển dụng',
              page: 1,
              bboxes: [],
            },
          ],
        },
        {
          group_code: 'TAI_LIEU_LUU_TRU',
          group_name: 'Tài liệu 1',
          source_document: { file_name: 'doc_1.pdf' },
          fields: [
            {
              name: 'TEN_LOAI_TAI_LIEU',
              display: 'Tên loại văn bản',
              type: 'string',
              value: 'Quyết định',
              page: 1,
              bboxes: [],
            },
            {
              name: 'SO_KY_HIEU',
              display: 'Số và ký hiệu',
              type: 'string',
              value: '01/QĐ',
              page: 1,
              bboxes: [],
            },
          ],
        },
        {
          group_code: 'TAI_LIEU_LUU_TRU',
          group_name: 'Tài liệu 2',
          source_document: { file_name: 'doc_2.pdf' },
          fields: [
            {
              name: 'TEN_LOAI_TAI_LIEU',
              display: 'Tên loại văn bản',
              type: 'string',
              value: 'Quyết định',
              page: 1,
              bboxes: [],
            },
            {
              name: 'SO_KY_HIEU',
              display: 'Số và ký hiệu',
              type: 'string',
              value: '02/QĐ',
              page: 1,
              bboxes: [],
            },
          ],
        },
      ],
    }

    it('only attributes rejected field to the specific document matching scoped key', () => {
      // Reject SO_KY_HIEU only on doc_1.pdf
      const rejectFields = ['QUYET_DINH:doc_1.SO_KY_HIEU']
      const summary = buildRejectedFieldsSummaryByDocument(
        rejectFields,
        mockMetadata,
      )

      expect(summary).toHaveLength(1)
      expect(summary[0].fileLabel).toBe('doc_1.pdf')
      expect(summary[0].fieldLabels).toEqual(['Số và ký hiệu'])
    })

    it('groups multiple rejected fields in same document', () => {
      const rejectFields = [
        'QUYET_DINH:doc_1.SO_KY_HIEU',
        'QUYET_DINH:doc_1.TEN_LOAI_TAI_LIEU',
      ]
      const summary = buildRejectedFieldsSummaryByDocument(
        rejectFields,
        mockMetadata,
      )

      expect(summary).toHaveLength(1)
      expect(summary[0].fileLabel).toBe('doc_1.pdf')
      expect(summary[0].fieldLabels).toEqual(['Tên loại văn bản', 'Số và ký hiệu'])
    })

    it('handles legacy unscoped keys by matching all applicable groups', () => {
      // Legacy key without fileRef
      const rejectFields = ['TAI_LIEU_LUU_TRU.SO_KY_HIEU']
      const summary = buildRejectedFieldsSummaryByDocument(
        rejectFields,
        mockMetadata,
      )

      expect(summary).toHaveLength(2)
      expect(summary.map((s) => s.fileLabel)).toEqual(['doc_1.pdf', 'doc_2.pdf'])
    })

    it('returns empty array when no rejectFields match', () => {
      const summary = buildRejectedFieldsSummaryByDocument(
        ['NON_EXISTENT.FIELD'],
        mockMetadata,
      )
      expect(summary).toEqual([])
    })
  })
})
