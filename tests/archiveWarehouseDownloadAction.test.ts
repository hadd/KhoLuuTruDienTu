/**
 * Tests for actions.download capability in dossier detail.
 */
import { describe, expect, it } from 'vitest'

import type { ArchiveWarehouseDossierDetailT } from '@/features/archive-warehouse/types'

function canShowDownload(
  detail: Pick<ArchiveWarehouseDossierDetailT, 'actions'> | null | undefined,
): boolean {
  return detail?.actions?.download === true
}

function areAllPdfFilesUnlocked(
  files: Array<{ accessLocked?: boolean }> | undefined,
): boolean {
  if (!files?.length) return true
  return files.every((file) => !file.accessLocked)
}

function isDownloadActionEnabled(
  detail:
    | (Pick<ArchiveWarehouseDossierDetailT, 'actions'> & {
        files?: Array<{ accessLocked?: boolean }>
      })
    | null
    | undefined,
): boolean {
  return canShowDownload(detail) && areAllPdfFilesUnlocked(detail?.files)
}

describe('actions.download capability', () => {
  it('shows download button when actions.download is true', () => {
    expect(
      canShowDownload({
        actions: {
          edit: false,
          delete: false,
          reupload: false,
          download: true,
        },
      }),
    ).toBe(true)
  })

  it('hides download button when actions.download is false', () => {
    expect(
      canShowDownload({
        actions: {
          edit: false,
          delete: false,
          reupload: false,
          download: false,
        },
      }),
    ).toBe(false)
  })

  it('hides download button when actions is undefined', () => {
    expect(canShowDownload({ actions: undefined })).toBe(false)
  })

  it('hides download button when detail is null', () => {
    expect(canShowDownload(null)).toBe(false)
  })
})

describe('download enabled when all PDFs unlocked', () => {
  const baseActions = {
    edit: false,
    delete: false,
    reupload: false,
    download: true,
  }

  it('enables download when every file is unlocked', () => {
    expect(
      isDownloadActionEnabled({
        actions: baseActions,
        files: [{ accessLocked: false }, { accessLocked: false }],
      }),
    ).toBe(true)
  })

  it('disables download when any file is still locked', () => {
    expect(
      isDownloadActionEnabled({
        actions: baseActions,
        files: [{ accessLocked: false }, { accessLocked: true }],
      }),
    ).toBe(false)
  })

  it('disables download when permission is missing even if files are unlocked', () => {
    expect(
      isDownloadActionEnabled({
        actions: { ...baseActions, download: false },
        files: [{ accessLocked: false }],
      }),
    ).toBe(false)
  })
})
