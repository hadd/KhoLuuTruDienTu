import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type {PdfFieldHighlight} from '@/components/common/PdfViewer';
import { PdfViewer } from '@/components/common/PdfViewer'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  deleteArchiveWarehouseFiles,
  updateArchiveWarehouseFileDocumentType,
} from '@/features/archive-warehouse/api/archiveWarehouseClient'
import { ArchiveWarehouseMoveFileDialog } from '@/features/archive-warehouse/components/ArchiveWarehouseMoveFileDialog'
import { ArchiveWarehouseReuploadDialog } from '@/features/archive-warehouse/components/ArchiveWarehouseReuploadDialog'
import {
  archiveWarehouseDocumentTypesQueryOptions,
  archiveWarehouseDossierDetailQueryOptions,
} from '@/features/archive-warehouse/queries'
import type { ArchiveWarehouseDossierFileT } from '@/features/archive-warehouse/types'
import { isFieldAllowed } from '@/features/data-config/lib/assignmentHelpers'
import { coerceMetadataText } from '@/features/data-management/lib/metadataDate'
import type {MetadataGroup} from '@/features/data-management/lib/metadataHelpers';
import {
  fetchDossierMetadata,
  getMetadataGroupDisplayName,
  matchMetadataFields,
  resolveOcrPdfUrlFromFile
} from '@/features/data-management/lib/metadataHelpers'
import type { DataDocumentFieldT, DataDossierMetadataT } from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'
import { formatFileSize } from '@/lib/utils/format'
import { translateError } from '@/lib/utils/translate-error'

/** Viewport below AppHeader (h-14) and main content padding (p-6). */
const STICKY_VIEWER_HEIGHT = 'calc(100dvh - 3.5rem - 3rem)'

function parseHighlightBbox(raw?: string | null): [number, number, number, number] | null {
  if (!raw?.trim()) return null
  const parts = raw.split(',').map((part) => Number(part.trim()))
  if (parts.length < 4 || parts.some((n) => !Number.isFinite(n))) return null
  return [parts[0], parts[1], parts[2], parts[3]]
}

function resolveFileByName(
  files: Array<ArchiveWarehouseDossierFileT>,
  fileName?: string | null,
): ArchiveWarehouseDossierFileT | null {
  if (!fileName) return null
  const normalized = fileName.trim().toLowerCase()
  return (
    files.find((file) => file.fileName.toLowerCase() === normalized) ??
    files.find((file) => file.filePath?.toLowerCase().endsWith(normalized)) ??
    null
  )
}

type ArchiveWarehouseFileViewerProps = {
  dossierId: string
  fondId: string
  files: Array<ArchiveWarehouseDossierFileT>
  currentMetadataUrl?: string | null
  selectedFileId?: string | null
  preferredFileName?: string | null
  highlightPage?: number | null
  highlightBbox?: string | null
  onSelectFile: (fileId: string) => void
  canReupload: boolean
  canDelete: boolean
  canMove: boolean
  canEditDocumentType?: boolean
  metadataViewAccess?: Record<string, Array<string> | null>
  onDossierLeftWarehouse: () => void
}

const DOCUMENT_TYPE_NONE = '__none__'

export function ArchiveWarehouseFileViewer({
  dossierId,
  fondId,
  files,
  currentMetadataUrl,
  selectedFileId,
  preferredFileName,
  highlightPage,
  highlightBbox,
  onSelectFile,
  canReupload,
  canDelete,
  canMove,
  canEditDocumentType = false,
  metadataViewAccess = {},
  onDossierLeftWarehouse,
}: ArchiveWarehouseFileViewerProps) {
  const { t } = useTranslation('archive-warehouse')
  const queryClient = useQueryClient()
  const [reuploadOpen, setReuploadOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [selectedBulkIds, setSelectedBulkIds] = useState<Set<string>>(
    () => new Set(),
  )

  const documentTypesQuery = useQuery(archiveWarehouseDocumentTypesQueryOptions())
  const documentTypes = documentTypesQuery.data?.items ?? []

  const preferredFile = useMemo(
    () => resolveFileByName(files, preferredFileName),
    [files, preferredFileName],
  )

  const effectiveFileId =
    selectedFileId ?? preferredFile?.id ?? files[0]?.id ?? null
  const selectedFile = files.find((file) => file.id === effectiveFileId) ?? null
  const selectedBulkFiles = useMemo(
    () => files.filter((file) => selectedBulkIds.has(file.id)),
    [files, selectedBulkIds],
  )
  const selectableFiles = files.slice(0, Math.max(0, files.length - 1))
  const allSelectableChecked =
    selectableFiles.length > 0 &&
    selectableFiles.every((file) => selectedBulkIds.has(file.id))

  useEffect(() => {
    if (!effectiveFileId && files[0]?.id) {
      onSelectFile(files[0].id)
      return
    }
    if (!selectedFileId && preferredFile?.id) {
      onSelectFile(preferredFile.id)
    }
  }, [effectiveFileId, files, onSelectFile, preferredFile?.id, selectedFileId])

  useEffect(() => {
    const availableIds = new Set(files.map((file) => file.id))
    setSelectedBulkIds((current) => {
      const next = new Set([...current].filter((id) => availableIds.has(id)))
      return next.size === current.size ? current : next
    })
  }, [files])

  const metadataQuery = useQuery({
    queryKey: ['archive-warehouse', 'dossier-metadata', dossierId, currentMetadataUrl],
    queryFn: () => fetchDossierMetadata(currentMetadataUrl ?? undefined),
    enabled: Boolean(currentMetadataUrl),
  })

  const metadata: DataDossierMetadataT | undefined = metadataQuery.data

  const selectedFields = useMemo(() => {
    if (!selectedFile || !metadata?.metadata_groups) return [] as Array<DataDocumentFieldT>
    const fileRef = selectedFile.filePath || selectedFile.fileName
    const matched =
      matchMetadataFields(
        fileRef,
        metadata.metadata_groups as unknown as Array<MetadataGroup>,
      ) ?? []
    const docTypeId = selectedFile.documentTypeId
    if (!docTypeId || !metadataViewAccess) return matched
    const allowed = metadataViewAccess[docTypeId]
    if (allowed === undefined || allowed === null) return matched
    return matched.filter((field) =>
      isFieldAllowed(`${field.group_code}.${field.name}`, allowed),
    )
  }, [metadata, metadataViewAccess, selectedFile])

  const selectedGroupName = useMemo(() => {
    if (!selectedFile || !metadata?.metadata_groups) return null
    const fileRef = selectedFile.filePath || selectedFile.fileName
    const group = metadata.metadata_groups.find((item) => {
      const fields = matchMetadataFields(fileRef, [
        item as unknown as MetadataGroup,
      ])
      return Boolean(fields?.length)
    })
    return group ? getMetadataGroupDisplayName(group) : null
  }, [metadata, selectedFile])

  const pdfUrl = useMemo(() => {
    if (!selectedFile) return null
    const ocrUrl = resolveOcrPdfUrlFromFile(
      selectedFile as unknown as Record<string, unknown>,
    )
    return ocrUrl || selectedFile.fileUrl || null
  }, [selectedFile])

  const searchHighlight = useMemo((): PdfFieldHighlight | null => {
    const bbox = parseHighlightBbox(highlightBbox)
    if (!highlightPage || highlightPage < 1 || !bbox) return null
    return {
      page: highlightPage,
      bboxes: [bbox],
    }
  }, [highlightBbox, highlightPage])

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (selectedBulkFiles.length === 0) throw new Error('No files selected')
      return deleteArchiveWarehouseFiles(
        dossierId,
        selectedBulkFiles.map((file) => file.id),
      )
    },
    onSuccess: async (result) => {
      toast.success(result.message || t('delete.success'))
      await queryClient.invalidateQueries({ queryKey: ['archive-warehouse'] })
      onDossierLeftWarehouse()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? translateError(error) : t('delete.failed'),
      )
    },
  })

  const documentTypeMutation = useMutation({
    mutationFn: (documentTypeId: string | null) => {
      if (!selectedFile) throw new Error('No file selected')
      return updateArchiveWarehouseFileDocumentType(
        dossierId,
        selectedFile.id,
        documentTypeId,
      )
    },
    onSuccess: async () => {
      toast.success(t('detail.documentTypeUpdated'))
      await queryClient.invalidateQueries({
        queryKey: archiveWarehouseDossierDetailQueryOptions(dossierId).queryKey,
      })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? translateError(error)
          : t('detail.documentTypeUpdateFailed'),
      )
    },
  })

  if (files.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('detail.noFiles')}</p>
    )
  }

  return (
    <div
      className="sticky top-0 z-10 flex flex-col gap-3 bg-background"
      style={{ height: STICKY_VIEWER_HEIGHT }}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 bg-background py-1">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allSelectableChecked}
            disabled={selectableFiles.length === 0}
            aria-label={t('bulk.selectAll')}
            onCheckedChange={(checked) => {
              setSelectedBulkIds(
                checked
                  ? new Set(selectableFiles.map((file) => file.id))
                  : new Set(),
              )
            }}
          />
          <h3 className="text-sm font-medium text-foreground">
            {t('detail.files')}
          </h3>
          {selectedBulkFiles.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {t('bulk.selected', { count: selectedBulkFiles.length })}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {canMove ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={
                selectedBulkFiles.length === 0 ||
                selectedBulkFiles.length >= files.length
              }
              onClick={() => setMoveOpen(true)}
            >
              <ArrowRightLeft className="size-4" aria-hidden />
              {t('move.action')}
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2 text-destructive"
              disabled={
                selectedBulkFiles.length === 0 ||
                selectedBulkFiles.length >= files.length ||
                deleteMutation.isPending
              }
              onClick={() => {
                if (
                  window.confirm(
                    selectedBulkFiles.length === 1
                      ? t('delete.confirm', {
                          fileName: selectedBulkFiles[0].fileName,
                        })
                      : t('delete.bulkConfirm', {
                          count: selectedBulkFiles.length,
                        }),
                  )
                ) {
                  deleteMutation.mutate()
                }
              }}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" aria-hidden />
              )}
              {t('delete.action')}
            </Button>
          ) : null}
          {canReupload && selectedFile ? (
            <Button
              type="button"
              size="sm"
              className="gap-2"
              onClick={() => setReuploadOpen(true)}
            >
              <Upload className="size-4" aria-hidden />
              {t('reupload.action')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="min-h-0 overflow-y-auto rounded-lg border">
          <ul className="space-y-1 p-2">
            {files.map((file) => {
              const active = file.id === effectiveFileId
              return (
                <li key={file.id}>
                  <div
                    className={cn(
                      'flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
                      active
                        ? 'bg-primary/10 text-foreground'
                        : 'hover:bg-muted text-muted-foreground',
                    )}
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={selectedBulkIds.has(file.id)}
                      aria-label={t('bulk.selectFile', { fileName: file.fileName })}
                      onClick={(event) => event.stopPropagation()}
                      onCheckedChange={(checked) => {
                        setSelectedBulkIds((current) => {
                          const next = new Set(current)
                          if (checked) next.add(file.id)
                          else next.delete(file.id)
                          return next
                        })
                      }}
                    />
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-start gap-2 text-left"
                      onClick={() => onSelectFile(file.id)}
                    >
                    <FileText className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">
                        {file.fileName}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatFileSize((file.fileSizeKb ?? 0) * 1024)}
                        {file.documentTypeName
                          ? ` · ${file.documentTypeName}`
                          : ''}
                      </span>
                    </span>
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="grid min-h-0 gap-3 overflow-hidden lg:grid-cols-2">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border">
            <div className="shrink-0 space-y-2 border-b px-3 py-2">
              <p className="truncate text-sm font-medium">
                {selectedGroupName ?? selectedFile?.fileName ?? t('detail.fileMetadata')}
              </p>
              {selectedFile ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {t('detail.documentType')}
                  </p>
                  <Select
                    value={selectedFile.documentTypeId ?? DOCUMENT_TYPE_NONE}
                    disabled={!canEditDocumentType || documentTypeMutation.isPending}
                    onValueChange={(next) => {
                      documentTypeMutation.mutate(
                        next === DOCUMENT_TYPE_NONE ? null : next,
                      )
                    }}
                  >
                    <SelectTrigger className="h-8" aria-label={t('detail.documentType')}>
                      <SelectValue placeholder={t('detail.documentTypePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DOCUMENT_TYPE_NONE}>
                        {t('detail.documentTypeNone')}
                      </SelectItem>
                      {documentTypes.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">{t('detail.readOnlyHint')}</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-3 p-3">
                {metadataQuery.isPending ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : null}
                {!metadataQuery.isPending && selectedFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t('detail.noFileMetadata')}
                  </p>
                ) : null}
                {selectedFields.map((field, index) => (
                  <div
                    key={`${field.name}-${index}`}
                    className="grid gap-1 sm:grid-cols-[140px_minmax(0,1fr)]"
                  >
                    <dt className="text-xs text-muted-foreground">
                      {field.display || field.name}
                    </dt>
                    <dd className="whitespace-pre-wrap break-words text-sm">
                      {coerceMetadataText(field.value) || '—'}
                    </dd>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border">
            {pdfUrl ? (
              <PdfViewer
                key={selectedFile?.id ?? 'none'}
                fileUrl={pdfUrl}
                fileName={selectedFile?.fileName}
                className="min-h-0 flex-1"
                showBorder={false}
                renderTextLayer
                renderAnnotationLayer
                highlight={searchHighlight}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center p-4">
                <p className="text-sm text-muted-foreground">{t('detail.noPdf')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedFile ? (
        <>
          <ArchiveWarehouseReuploadDialog
            open={reuploadOpen}
            onOpenChange={setReuploadOpen}
            dossierId={dossierId}
            fileId={selectedFile.id}
            fileName={selectedFile.fileName}
            onCompleted={onDossierLeftWarehouse}
          />
        </>
      ) : null}
      <ArchiveWarehouseMoveFileDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        dossierId={dossierId}
        fileIds={selectedBulkFiles.map((file) => file.id)}
        fileNames={selectedBulkFiles.map((file) => file.fileName)}
        fondId={fondId}
        onMoved={onDossierLeftWarehouse}
      />
    </div>
  )
}
