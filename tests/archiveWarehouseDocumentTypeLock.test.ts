/**
 * Document type is read-only for files already in the archive warehouse.
 */
import { describe, expect, it } from 'vitest'

import * as archiveWarehouseClient from '@/features/archive-warehouse/api/archiveWarehouseClient'

describe('archive warehouse document type lock', () => {
  it('does not expose a client method to update document type', () => {
    expect(
      'updateArchiveWarehouseFileDocumentType' in archiveWarehouseClient,
    ).toBe(false)
  })

  it('still exposes read APIs for warehouse document types', () => {
    expect(typeof archiveWarehouseClient.getArchiveWarehouseDocumentTypes).toBe(
      'function',
    )
    expect(typeof archiveWarehouseClient.getArchiveWarehouseDossierDetail).toBe(
      'function',
    )
  })
})
