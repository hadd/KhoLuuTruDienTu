import { apiClient } from '@/lib/api/apiClient'
import { notifyZipPasswordLocked } from '@/features/security-level/lib/zipPasswordToast'

export type ArchiveWarehouseExportModeT = 'metadata' | 'dip'

export interface ArchiveWarehouseMetadataExportConfigT {
  presetId?: string
  applyWatermark?: boolean
  dossierAccessPassword?: string
  /** Per-dossier passwords for multi export (overrides single dossierAccessPassword). */
  dossierAccessPasswords?: Record<string, string>
}

export interface ArchiveWarehouseDipExportConfigT {
  applyWatermark?: boolean
  dossierAccessPassword?: string
  dossierAccessPasswords?: Record<string, string>
}

export type ExportCheckResultT = {
  ok: true
  zipPasswordSource: 'personal_pin' | 'dossier' | 'none'
  needsDossierPassword: boolean
  applyWatermark?: boolean
}

function resolveDownloadFileName(
  contentDisposition: string | undefined,
  fallbackName: string,
): string {
  if (!contentDisposition) return fallbackName

  const match = /filename\*?=(?:UTF-8''|"?)([^";]+)/i.exec(contentDisposition)
  if (!match?.[1]) return fallbackName

  return decodeURIComponent(match[1].replace(/"/g, ''))
}

function normalizeExportFileName(fileName: string): string {
  if (/\.zip$/i.test(fileName)) return fileName
  const base = fileName.replace(/\.xlsx?$/i, '').replace(/\.+$/, '')
  return base ? `${base}.zip` : 'export.zip'
}

function saveExportBlob(
  data: Blob,
  contentDisposition: string | undefined,
  fallbackName: string,
): void {
  const fileName = normalizeExportFileName(
    resolveDownloadFileName(contentDisposition, fallbackName),
  )

  const url = window.URL.createObjectURL(new Blob([data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

const EXPORT_TIMEOUT_MS = 600_000
const MULTI_DOWNLOAD_GAP_MS = 400

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function resolvePasswordForDossier(
  dossierId: string,
  config?: {
    dossierAccessPassword?: string
    dossierAccessPasswords?: Record<string, string>
  },
): string | undefined {
  const fromMap = config?.dossierAccessPasswords?.[dossierId]?.trim()
  if (fromMap) return fromMap
  return config?.dossierAccessPassword?.trim() || undefined
}

async function postExportZip(
  path: string,
  body: Record<string, unknown>,
  fallbackName: string,
): Promise<void> {
  const dossierIds = Array.isArray(body.dossierIds)
    ? (body.dossierIds as Array<string>)
    : []
  const response = await apiClient.post<Blob>(path, body, {
    responseType: 'blob',
    timeout: EXPORT_TIMEOUT_MS,
    _skipGlobalErrorToast: true,
    dossierId: dossierIds[0] ?? null,
  })

  saveExportBlob(
    response.data,
    response.headers['content-disposition'],
    fallbackName,
  )
  notifyZipPasswordLocked(response.headers as Record<string, unknown>)
}

/** Probe access + ZIP password needs without downloading. */
export async function checkDossierExportRequirements(
  dossierId: string,
  mode: ArchiveWarehouseExportModeT,
  dossierAccessPassword?: string,
): Promise<ExportCheckResultT> {
  const path =
    mode === 'dip'
      ? '/api/v1/dossiers/dip/export'
      : '/api/v1/dossiers/metadata/export'
  const body: Record<string, unknown> = {
    dossierIds: [dossierId],
    checkOnly: true,
  }
  if (dossierAccessPassword?.trim()) {
    body.dossierAccessPassword = dossierAccessPassword.trim()
  }

  const response = await apiClient.post<ExportCheckResultT>(path, body, {
    _skipGlobalErrorToast: true,
    dossierId,
  })
  return response.data
}

/**
 * Export one ZIP per dossier (sequential) so each archive can carry its own password.
 */
export async function exportDossiersMetadataByIds(
  dossierIds: Array<string>,
  downloadName?: string,
  config?: ArchiveWarehouseMetadataExportConfigT,
): Promise<void> {
  if (dossierIds.length === 0) return

  for (let i = 0; i < dossierIds.length; i += 1) {
    const id = dossierIds[i]!
    const fallbackName =
      dossierIds.length === 1 && downloadName?.trim()
        ? `${downloadName.trim()}.zip`
        : `dossier-${id}.zip`

    const body: Record<string, unknown> = { dossierIds: [id] }
    if (config?.presetId) body.presetId = config.presetId
    if (config?.applyWatermark) body.applyWatermark = true
    const password = resolvePasswordForDossier(id, config)
    if (password) body.dossierAccessPassword = password

    await postExportZip('/api/v1/dossiers/metadata/export', body, fallbackName)
    if (i < dossierIds.length - 1) await sleep(MULTI_DOWNLOAD_GAP_MS)
  }
}

export async function exportDossiersDipByIds(
  dossierIds: Array<string>,
  downloadName?: string,
  config?: ArchiveWarehouseDipExportConfigT,
): Promise<void> {
  if (dossierIds.length === 0) return

  for (let i = 0; i < dossierIds.length; i += 1) {
    const id = dossierIds[i]!
    const fallbackName =
      dossierIds.length === 1 && downloadName?.trim()
        ? `${downloadName.trim()}-dip.zip`
        : `dossier-${id}-dip.zip`

    const body: Record<string, unknown> = { dossierIds: [id] }
    if (config?.applyWatermark) body.applyWatermark = true
    const password = resolvePasswordForDossier(id, config)
    if (password) body.dossierAccessPassword = password

    await postExportZip('/api/v1/dossiers/dip/export', body, fallbackName)
    if (i < dossierIds.length - 1) await sleep(MULTI_DOWNLOAD_GAP_MS)
  }
}

export async function exportFoldersMetadataByIds(
  folderIds: Array<string>,
  downloadName?: string,
  config?: ArchiveWarehouseMetadataExportConfigT,
): Promise<void> {
  if (folderIds.length === 0) return

  const fallbackName = downloadName?.trim()
    ? `${downloadName.trim()}.zip`
    : folderIds.length === 1
      ? `folder-${folderIds[0]}.zip`
      : 'multi-folders-metadata-export.zip'

  const body: Record<string, unknown> = { folderIds }
  if (config?.presetId) body.presetId = config.presetId
  if (config?.applyWatermark) body.applyWatermark = true
  if (config?.dossierAccessPassword?.trim()) {
    body.dossierAccessPassword = config.dossierAccessPassword.trim()
  }

  await postExportZip('/api/v1/folders/metadata/export', body, fallbackName)
}
