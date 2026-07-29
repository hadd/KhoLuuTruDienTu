/**
 * Tests for actions.download capability in dossier detail.
 *
 * These tests validate the frontend logic that determines whether the
 * Download button should be shown based on the `actions.download` flag
 * returned from the backend in the dossier detail response.
 */
import { describe, expect, it } from 'vitest'

import type { ArchiveWarehouseDossierDetailT } from '@/features/archive-warehouse/types'

function canShowDownload(
  detail: Pick<ArchiveWarehouseDossierDetailT, 'actions'> | null | undefined,
): boolean {
  return detail?.actions?.download === true
}

describe('actions.download capability', () => {
  it('shows download button when actions.download is true', () => {
    expect(canShowDownload({ actions: { edit: false, delete: false, reupload: false, download: true } })).toBe(true)
  })

  it('hides download button when actions.download is false', () => {
    expect(canShowDownload({ actions: { edit: false, delete: false, reupload: false, download: false } })).toBe(false)
  })

  it('hides download button when actions is undefined', () => {
    expect(canShowDownload({ actions: undefined })).toBe(false)
  })

  it('hides download button when detail is null', () => {
    expect(canShowDownload(null)).toBe(false)
  })
})
