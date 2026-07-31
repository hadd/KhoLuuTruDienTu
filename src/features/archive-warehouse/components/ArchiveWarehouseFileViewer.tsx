import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, Download, FileText, Loader2, Lock, Trash2, Upload } from 'lucide-react'
import type {ReactNode} from 'react';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type {PdfFieldHighlight} from '@/components/common/PdfViewer';
import { PdfViewer } from '@/components/common/PdfViewer'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { deleteArchiveWarehouseFiles } from '@/features/archive-warehouse/api/archiveWarehouseClient'
import { ArchiveWarehouseMoveFileDialog } from '@/features/archive-warehouse/components/ArchiveWarehouseMoveFileDialog'
import { ArchiveWarehouseReuploadDialog } from '@/features/archive-warehouse/components/ArchiveWarehouseReuploadDialog'
import { ArchiveWarehouseSecurityDialog } from '@/features/archive-warehouse/components/ArchiveWarehouseSecurityDialog'
import { archiveWarehouseDossierDetailQueryOptions } from '@/features/archive-warehouse/queries'
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
import { verifyFileAccess, verifySecurityLevelAccess } from '@/features/security-level/api/securityLevelClient'
import { SecurityAccessPasswordDialog } from '@/features/security-level/components/SecurityAccessPasswordDialog'
import {
  rememberDossierUnlockedFile,
  rememberDossierUnlockedSecurityLevel,
  setFileAccessToken,
  setSecurityLevelAccessToken,
} from '@/features/security-level/lib/securityAccessTokenStore'
import { activeSecurityLevelsQueryOptions } from '@/features/security-level/queries'
import { cn } from '@/lib/utils/cn'
import { formatFileSize } from '@/lib/utils/format'
import { translateError } from '@/lib/utils/translate-error'

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

function resolveFileSecurityLevelId(
  file: ArchiveWarehouseDossierFileT,
): string | null {
  return file.requiredSecurityLevelId ?? file.securityLevelId ?? null
}

function formatSecurityLevelOrder(
  securityLevelId: string | null | undefined,
  levelsById: Map<string, number>,
): string | null {
  if (!securityLevelId) return null
  const levelOrder = levelsById.get(securityLevelId)
  if (levelOrder == null) return null
  return String(levelOrder)
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
  canDownload?: boolean
  downloadDisabled?: boolean
  onDownload?: () => void
  canConfigureSecurity?: boolean
  singleFileMode?: boolean
  hideToolbar?: boolean
  metadataViewAccess?: Record<string, Array<string> | null>
  onDossierLeftWarehouse: () => void
  children?: ReactNode
}

type FileViewerContextValue = {
  dossierId: string
  fondId: string
  files: Array<ArchiveWarehouseDossierFileT>
  effectiveFileId: string | null
  selectedFile: ArchiveWarehouseDossierFileT | null
  selectedBulkIds: Set<string>
  setSelectedBulkIds: React.Dispatch<React.SetStateAction<Set<string>>>
  selectedBulkFiles: Array<ArchiveWarehouseDossierFileT>
  selectableFiles: Array<ArchiveWarehouseDossierFileT>
  unlockedSelectableFiles: Array<ArchiveWarehouseDossierFileT>
  unlockedFiles: Array<ArchiveWarehouseDossierFileT>
  allSelectableChecked: boolean
  canReupload: boolean
  canDelete: boolean
  canMove: boolean
  canDownload: boolean
  downloadDisabled: boolean
  onDownload: (() => void) | undefined
  canConfigureSecurity: boolean
  singleFileMode: boolean
  hideToolbar: boolean
  onSelectFile: (fileId: string) => void
  onDossierLeftWarehouse: () => void
  reuploadOpen: boolean
  setReuploadOpen: (open: boolean) => void
  moveOpen: boolean
  setMoveOpen: (open: boolean) => void
  deleteMutation: {
    isPending: boolean
    mutate: () => void
  }
  metadataQuery: {
    isPending: boolean
  }
  metadata: DataDossierMetadataT | undefined
  selectedFields: Array<DataDocumentFieldT>
  selectedGroupName: string | null
  pdfUrl: string | null
  searchHighlight: PdfFieldHighlight | null
  lockedFileDialogOpen: boolean
  setLockedFileDialogOpen: (open: boolean) => void
  lockedFile: ArchiveWarehouseDossierFileT | null
  setLockedFileId: (fileId: string | null) => void
  unlockFileMutation: {
    isPending: boolean
    mutateAsync: (password: string) => Promise<void>
  }
  securityLevelById: Map<string, number>
  securityDialogOpen: boolean
  setSecurityDialogOpen: (open: boolean) => void
  securityTargetFiles: Array<ArchiveWarehouseDossierFileT>
  setSecurityTargetFiles: React.Dispatch<
    React.SetStateAction<Array<ArchiveWarehouseDossierFileT>>
  >
}

const FileViewerContext = createContext<FileViewerContextValue | null>(null)

function useFileViewerContext() {
  const context = useContext(FileViewerContext)
  if (!context) {
    throw new Error('ArchiveWarehouseFileViewer components must be used within ArchiveWarehouseFileViewer')
  }
  return context
}

function useDeleteFilesMutation(
  dossierId: string,
  selectedBulkFiles: Array<ArchiveWarehouseDossierFileT>,
  onDossierLeftWarehouse: () => void,
) {
  const { t } = useTranslation('archive-warehouse')
  const queryClient = useQueryClient()

  return useMutation({
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
}

function useMetadataQuery(dossierId: string, currentMetadataUrl?: string | null) {
  return useQuery({
    queryKey: ['archive-warehouse', 'dossier-metadata', dossierId, currentMetadataUrl],
    queryFn: () => fetchDossierMetadata(currentMetadataUrl ?? undefined),
    enabled: Boolean(currentMetadataUrl),
  })
}

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
  canDownload = false,
  downloadDisabled = false,
  onDownload,
  canConfigureSecurity = false,
  singleFileMode = false,
  hideToolbar = false,
  metadataViewAccess = {},
  onDossierLeftWarehouse,
  children,
}: ArchiveWarehouseFileViewerProps) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('archive-warehouse')
  const { t: tSecurity } = useTranslation('security-level')
  const [reuploadOpen, setReuploadOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [lockedFileDialogOpen, setLockedFileDialogOpen] = useState(false)
  const [lockedFileId, setLockedFileId] = useState<string | null>(null)
  const [securityDialogOpen, setSecurityDialogOpen] = useState(false)
  const [securityTargetFiles, setSecurityTargetFiles] = useState<
    Array<ArchiveWarehouseDossierFileT>
  >([])
  const [selectedBulkIds, setSelectedBulkIds] = useState<Set<string>>(
    () => new Set(),
  )

  const { data: securityLevelsData } = useQuery(activeSecurityLevelsQueryOptions())
  const securityLevelById = useMemo(() => {
    const map = new Map<string, number>()
    for (const level of securityLevelsData?.items ?? []) {
      map.set(level.id, level.levelOrder)
    }
    return map
  }, [securityLevelsData])

  const preferredFile = useMemo(
    () => resolveFileByName(files, preferredFileName),
    [files, preferredFileName],
  )
  const firstUnlockedFile = useMemo(
    () => files.find((file) => !file.accessLocked) ?? files[0] ?? null,
    [files],
  )

  const effectiveFileId =
    selectedFileId ?? preferredFile?.id ?? firstUnlockedFile?.id ?? null
  const selectedFile = files.find((file) => file.id === effectiveFileId) ?? null
  const lockedFile =
    files.find((file) => file.id === lockedFileId) ??
    (selectedFile?.accessLocked ? selectedFile : null)
  const selectedBulkFiles = useMemo(
    () => files.filter((file) => selectedBulkIds.has(file.id)),
    [files, selectedBulkIds],
  )
  const selectableFiles = files.slice(0, Math.max(0, files.length - 1))
  const unlockedFiles = useMemo(
    () => files.filter((file) => !file.accessLocked),
    [files],
  )
  const unlockedSelectableFiles = selectableFiles.filter((f) => !f.accessLocked)
  const allSelectableChecked =
    unlockedFiles.length > 0 &&
    unlockedFiles.every((file) => selectedBulkIds.has(file.id))

  useEffect(() => {
    if (!effectiveFileId && firstUnlockedFile?.id) {
      onSelectFile(firstUnlockedFile.id)
      return
    }
    if (!selectedFileId && preferredFile?.id) {
      onSelectFile(preferredFile.id)
    }
  }, [effectiveFileId, firstUnlockedFile?.id, onSelectFile, preferredFile?.id, selectedFileId])

  useEffect(() => {
    const unlockedIds = new Set(files.filter((f) => !f.accessLocked).map((f) => f.id))
    setSelectedBulkIds((current) => {
      const next = new Set([...current].filter((id) => unlockedIds.has(id)))
      return next.size === current.size ? current : next
    })
  }, [files])

  useEffect(() => {
    if (lockedFileId && !files.some((file) => file.id === lockedFileId && file.accessLocked)) {
      setLockedFileDialogOpen(false)
      setLockedFileId(null)
    }
  }, [files, lockedFileId])

  const metadataQuery = useMetadataQuery(dossierId, currentMetadataUrl)
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

  const deleteMutation = useDeleteFilesMutation(
    dossierId,
    selectedBulkFiles,
    onDossierLeftWarehouse,
  )
  const unlockFileMutation = useMutation({
    mutationFn: async (password: string) => {
      if (!lockedFile) {
        throw new Error(tSecurity('access.unlockFailed'))
      }
      if (lockedFile.requiredFilePassword) {
        const result = await verifyFileAccess({
          securityLevelId: lockedFile.requiredSecurityLevelId ?? undefined,
          fileId: lockedFile.id,
          password,
        })
        setFileAccessToken(lockedFile.id, result.token, result.expiresIn)
        rememberDossierUnlockedFile(dossierId, lockedFile.id)
      } else {
        if (!lockedFile.requiredSecurityLevelId) {
          throw new Error(tSecurity('access.unlockFailed'))
        }
        const result = await verifySecurityLevelAccess({
          securityLevelId: lockedFile.requiredSecurityLevelId,
          password,
        })
        setSecurityLevelAccessToken(
          lockedFile.requiredSecurityLevelId,
          result.token,
          result.expiresIn,
        )
        rememberDossierUnlockedSecurityLevel(
          dossierId,
          lockedFile.requiredSecurityLevelId,
        )
      }
      await queryClient.fetchQuery(
        archiveWarehouseDossierDetailQueryOptions(dossierId),
      )
      onSelectFile(lockedFile.id)
    },
    onSuccess: () => {
      setLockedFileDialogOpen(false)
      toast.success(tSecurity('access.unlockSuccess'))
    },
    onError: (error) => {
      toast.error(translateError(error) || tSecurity('access.unlockFailed'))
    },
  })

  if (files.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('detail.noFiles')}</p>
    )
  }

  const contextValue: FileViewerContextValue = {
    dossierId,
    fondId,
    files,
    effectiveFileId,
    selectedFile,
    selectedBulkIds,
    setSelectedBulkIds,
    selectedBulkFiles,
    selectableFiles,
    unlockedSelectableFiles,
    allSelectableChecked,
    canReupload,
    canDelete,
    canMove,
    canDownload,
    downloadDisabled,
    onDownload,
    canConfigureSecurity,
    singleFileMode,
    hideToolbar,
    onSelectFile,
    onDossierLeftWarehouse,
    reuploadOpen,
    setReuploadOpen,
    moveOpen,
    setMoveOpen,
    deleteMutation,
    metadataQuery,
    metadata,
    selectedFields,
    selectedGroupName,
    pdfUrl,
    searchHighlight,
    lockedFileDialogOpen,
    setLockedFileDialogOpen,
    lockedFile,
    setLockedFileId,
    unlockFileMutation,
    securityLevelById,
    securityDialogOpen,
    setSecurityDialogOpen,
    securityTargetFiles,
    setSecurityTargetFiles,
    unlockedFiles,
  }

  return (
    <FileViewerContext.Provider value={contextValue}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children ?? (
          <>
            {!hideToolbar && !singleFileMode ? <ArchiveWarehouseFileViewerToolbar /> : null}
            <ArchiveWarehouseFileViewerPanels />
          </>
        )}
      </div>
      <ArchiveWarehouseFileViewerDialogs />
    </FileViewerContext.Provider>
  )
}

export function ArchiveWarehouseFileViewerToolbar() {
  const { t } = useTranslation('archive-warehouse')
  const {
    files,
    selectedBulkFiles,
    unlockedFiles,
    allSelectableChecked,
    setSelectedBulkIds,
    canMove,
    canDelete,
    canReupload,
    canDownload,
    downloadDisabled,
    onDownload,
    selectedFile,
    deleteMutation,
    setMoveOpen,
    setReuploadOpen,
    canConfigureSecurity,
    setSecurityDialogOpen,
    setSecurityTargetFiles,
    singleFileMode,
  } = useFileViewerContext()

  if (singleFileMode) return null

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={allSelectableChecked}
          disabled={unlockedFiles.length === 0}
          aria-label={t('bulk.selectAll')}
          onCheckedChange={(checked) => {
            setSelectedBulkIds(
              checked
                ? new Set(unlockedFiles.map((file) => file.id))
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
        {canDownload ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={downloadDisabled}
            title={downloadDisabled ? t('download.unlockAllRequired') : undefined}
            onClick={() => onDownload?.()}
          >
            <Download className="size-4" aria-hidden />
            {t('download.action')}
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
        {canConfigureSecurity ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={selectedBulkFiles.length === 0}
            title={
              selectedBulkFiles.length === 0
                ? t('security.selectFilesRequired')
                : undefined
            }
            onClick={() => {
              if (selectedBulkFiles.length === 0) {
                toast.error(t('security.selectFilesRequired'))
                return
              }
              setSecurityTargetFiles(selectedBulkFiles)
              setSecurityDialogOpen(true)
            }}
          >
            {t('security.configureFile')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function MetadataPanel() {
  const { t } = useTranslation('archive-warehouse')
  const {
    selectedFile,
    selectedGroupName,
    metadataQuery,
    selectedFields,
    securityLevelById,
  } = useFileViewerContext()

  const lockedLevel = selectedFile
    ? formatSecurityLevelOrder(
        resolveFileSecurityLevelId(selectedFile),
        securityLevelById,
      )
    : null

  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border">
      <div className="shrink-0 space-y-2 border-b px-3 py-2">
        <p className="truncate text-sm font-medium">
          {selectedGroupName ?? selectedFile?.fileName ?? t('detail.fileMetadata')}
        </p>
        {selectedFile ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {t('detail.documentType')}
            </p>
            <p className="text-sm text-foreground">
              {selectedFile.documentTypeName?.trim() ||
                t('detail.documentTypeNone')}
            </p>
          </div>
        ) : null}
        {selectedFile?.accessLocked ? (
          <p className="text-xs text-amber-600">
            {lockedLevel
              ? t('detail.fileLockedHintWithLevel', { level: lockedLevel })
              : t('detail.fileLockedHint')}
          </p>
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
          {selectedFile?.accessLocked ? (
            <p className="text-sm text-muted-foreground">
              {lockedLevel
                ? t('detail.fileLockedMetadataWithLevel', { level: lockedLevel })
                : t('detail.fileLockedMetadata')}
            </p>
          ) : null}
          {!metadataQuery.isPending && !selectedFile?.accessLocked && selectedFields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('detail.noFileMetadata')}
            </p>
          ) : null}
          {!selectedFile?.accessLocked && selectedFields.map((field, index) => (
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
  )
}

function PdfPanel() {
  const { t } = useTranslation('archive-warehouse')
  const {
    selectedFile,
    pdfUrl,
    searchHighlight,
    setLockedFileDialogOpen,
    setLockedFileId,
    securityLevelById,
  } = useFileViewerContext()

  const lockedLevel = selectedFile
    ? formatSecurityLevelOrder(
        resolveFileSecurityLevelId(selectedFile),
        securityLevelById,
      )
    : null

  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border">
      {selectedFile?.accessLocked ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
          <Lock className="size-8 text-amber-600" aria-hidden />
          <p className="text-sm text-muted-foreground">
            {lockedLevel
              ? t('detail.fileLockedPdfWithLevel', { level: lockedLevel })
              : t('detail.fileLockedPdf')}
          </p>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setLockedFileId(selectedFile.id)
              setLockedFileDialogOpen(true)
            }}
          >
            {t('detail.unlockFile')}
          </Button>
        </div>
      ) : pdfUrl ? (
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
  )
}

export function ArchiveWarehouseFileViewerPanels() {
  const { t } = useTranslation('archive-warehouse')
  const {
    files,
    effectiveFileId,
    selectedBulkIds,
    setSelectedBulkIds,
    onSelectFile,
    singleFileMode,
    selectedFile,
    canReupload,
    setReuploadOpen,
    setLockedFileDialogOpen,
    setLockedFileId,
    securityLevelById,
  } = useFileViewerContext()

  if (singleFileMode) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <h3 className="truncate text-sm font-medium text-foreground">
            {selectedFile?.fileName ?? t('detail.fileMetadata')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {canReupload && selectedFile ? (
              <Button
                type="button"
                size="sm"
                className="gap-2"
                disabled={selectedFile.accessLocked}
                onClick={() => setReuploadOpen(true)}
              >
                <Upload className="size-4" aria-hidden />
                {t('reupload.action')}
              </Button>
            ) : null}
            {selectedFile?.accessLocked ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setLockedFileId(selectedFile.id)
                  setLockedFileDialogOpen(true)
                }}
              >
                {t('detail.unlockFile')}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-2">
          <MetadataPanel />
          <PdfPanel />
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ul className="space-y-1 p-2">
            {files.map((file) => {
              const active = file.id === effectiveFileId
              const levelLabel = formatSecurityLevelOrder(
                resolveFileSecurityLevelId(file),
                securityLevelById,
              )
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
                      disabled={file.accessLocked}
                      aria-label={t('bulk.selectFile', { fileName: file.fileName })}
                      onClick={(event) => event.stopPropagation()}
                      onCheckedChange={(checked) => {
                        if (file.accessLocked) return
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
                      onClick={() => {
                        onSelectFile(file.id)
                        if (file.accessLocked) {
                          setLockedFileId(file.id)
                          setLockedFileDialogOpen(true)
                        }
                      }}
                    >
                      {file.accessLocked ? (
                        <Lock className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                      ) : (
                        <FileText className="mt-0.5 size-4 shrink-0" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">
                          {file.fileName}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {formatFileSize((file.fileSizeKb ?? 0) * 1024)}
                          {levelLabel
                            ? ` · ${t('detail.fileSecurityLevel', { level: levelLabel })}`
                            : ''}
                          {file.documentTypeName
                            ? ` · ${file.documentTypeName}`
                            : ''}
                          {file.accessLocked ? ` · ${t('detail.lockedLabel')}` : ''}
                        </span>
                      </span>
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      <div className="grid min-h-0 min-w-0 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-2">
        <MetadataPanel />
        <PdfPanel />
      </div>
    </div>
  )
}

function ArchiveWarehouseFileViewerDialogs() {
  const { t: tSecurity } = useTranslation('security-level')
  const {
    selectedFile,
    reuploadOpen,
    setReuploadOpen,
    moveOpen,
    setMoveOpen,
    dossierId,
    fondId,
    selectedBulkFiles,
    onDossierLeftWarehouse,
    lockedFileDialogOpen,
    setLockedFileDialogOpen,
    lockedFile,
    setLockedFileId,
    unlockFileMutation,
    securityDialogOpen,
    setSecurityDialogOpen,
    securityTargetFiles,
    setSecurityTargetFiles,
    setSelectedBulkIds,
  } = useFileViewerContext()

  return (
    <>
      {selectedFile ? (
        <ArchiveWarehouseReuploadDialog
          open={reuploadOpen}
          onOpenChange={setReuploadOpen}
          dossierId={dossierId}
          fileId={selectedFile.id}
          fileName={selectedFile.fileName}
          onCompleted={onDossierLeftWarehouse}
        />
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
      {securityTargetFiles.length > 0 ? (
        <ArchiveWarehouseSecurityDialog
          open={securityDialogOpen}
          onOpenChange={(open) => {
            setSecurityDialogOpen(open)
            if (!open) {
              setSecurityTargetFiles([])
            }
          }}
          dossierId={dossierId}
          targetFiles={securityTargetFiles.map((file) => ({
            id: file.id,
            fileName: file.fileName,
            securityLevelId: file.securityLevelId,
            passwordSource: file.passwordSource ?? 'none',
          }))}
          onSuccess={() => {
            setSelectedBulkIds(new Set())
            setSecurityTargetFiles([])
          }}
        />
      ) : null}
      <SecurityAccessPasswordDialog
        open={lockedFileDialogOpen}
        onOpenChange={(open) => {
          setLockedFileDialogOpen(open)
          if (!open) {
            unlockFileMutation.reset()
            setLockedFileId(null)
          }
        }}
        title={
          lockedFile?.requiredFilePassword
            ? tSecurity('access.fileTitle')
            : tSecurity('access.levelTitle')
        }
        description={
          lockedFile
            ? lockedFile.requiredFilePassword
              ? tSecurity('access.fileDescription')
              : tSecurity('access.levelDescription')
            : undefined
        }
        errorMessage={
          unlockFileMutation.error
            ? translateError(unlockFileMutation.error) ||
              tSecurity('access.unlockFailed')
            : undefined
        }
        isPending={unlockFileMutation.isPending}
        onSubmit={async (password) => {
          await unlockFileMutation.mutateAsync(password)
        }}
      />
    </>
  )
}
