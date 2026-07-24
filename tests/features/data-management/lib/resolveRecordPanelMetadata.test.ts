import { describe, expect, it } from 'vitest'

import { resolveRecordPanelMetadata } from '@/features/data-management/lib/metadataHelpers'
import type {
  DataDossierMetadataT,
  DataTreeNodeT,
} from '@/features/data-management/types'

const fullMetadata: DataDossierMetadataT = {
  metadata_groups: [
    {
      group_code: 'HO_SO_LUU_TRU',
      group_name: 'Ho so',
      fields: [
        {
          name: 'MA_HO_SO',
          display: 'Ma ho so',
          type: 'string',
          value: 'HS-1',
          page: 1,
          bboxes: [],
        },
        {
          name: 'GHI_CHU',
          display: 'Ghi chu',
          type: 'object',
          value: null,
          page: null,
          bboxes: [],
        },
      ],
    },
  ],
}

const filteredMetadata: DataDossierMetadataT = {
  metadata_groups: [
    {
      group_code: 'HO_SO_LUU_TRU',
      group_name: 'Ho so',
      fields: [
        {
          name: 'MA_HO_SO',
          display: 'Ma ho so',
          type: 'string',
          value: 'HS-1',
          page: 1,
          bboxes: [],
        },
      ],
    },
  ],
}

const node = {
  dossierMetadata: filteredMetadata,
  fullDossierMetadata: fullMetadata,
  allowedFields: ['HO_SO_LUU_TRU.MA_HO_SO'],
} as Pick<
  DataTreeNodeT,
  'dossierMetadata' | 'fullDossierMetadata' | 'allowedFields'
>

describe('resolveRecordPanelMetadata', () => {
  it('returns full metadata for QC reviewers', () => {
    const resolved = resolveRecordPanelMetadata(node, 'qc')
    expect(resolved?.metadata_groups[0]?.fields).toHaveLength(2)
  })

  it('returns filtered metadata for editors with field ACL', () => {
    const resolved = resolveRecordPanelMetadata(node, 'editor')
    expect(resolved?.metadata_groups[0]?.fields).toHaveLength(1)
  })
})
