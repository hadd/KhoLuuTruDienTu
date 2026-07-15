  import { apiClient } from '@/lib/api/apiClient'

export type ArchiveWarehouseExportModeT = 'metadata' | 'dip'

export interface ArchiveWarehouseMetadataExportConfigT {
  presetId?: string
  placementId?: string
}

export interface ArchiveWarehouseDipExportConfigT {
  placementId?: string
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

async function postExportZip(
  path: string,
  body: Record<string, unknown>,
  fallbackName: string,
): Promise<void> {
  const response = await apiClient.post<Blob>(path, body, {
    responseType: 'blob',
    timeout: EXPORT_TIMEOUT_MS,
    _skipGlobalErrorToast: true,
  })

  saveExportBlob(
    response.data,
    response.headers['content-disposition'],
    fallbackName,
  )
}

export async function exportDossiersMetadataByIds(
  dossierIds: Array<string>,
  downloadName?: string,
  config?: ArchiveWarehouseMetadataExportConfigT,
): Promise<void> {
  if (dossierIds.length === 0) return

  const fallbackName = downloadName?.trim()
    ? `${downloadName.trim()}.zip`
    : dossierIds.length === 1
      ? `dossier-${dossierIds[0]}.zip`
      : 'multi-dossiers-metadata-export.zip'

  const body: Record<string, unknown> = { dossierIds }
  if (config?.presetId) body.presetId = config.presetId
  if (config?.placementId) body.placementId = config.placementId

  await postExportZip('/api/v1/dossiers/metadata/export', body, fallbackName)
}

export async function exportDossiersDipByIds(
  dossierIds: Array<string>,
  downloadName?: string,
  config?: ArchiveWarehouseDipExportConfigT,
): Promise<void> {
  if (dossierIds.length === 0) return

  const fallbackName = downloadName?.trim()
    ? `${downloadName.trim()}-dip.zip`
    : dossierIds.length === 1
      ? `dossier-${dossierIds[0]}-dip.zip`
      : 'multi-dip-export.zip'

  const body: Record<string, unknown> = { dossierIds }
  if (config?.placementId) body.placementId = config.placementId

  await postExportZip('/api/v1/dossiers/dip/export', body, fallbackName)
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
  if (config?.placementId) body.placementId = config.placementId

  await postExportZip('/api/v1/folders/metadata/export', body, fallbackName)
}
