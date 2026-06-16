import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  isDataManagementUploadError,
  validateFolderUploadFiles,
} from '@/features/data-management/api/dataManagementClient'
import type {
  FileUploadResult,
  UploadFolderResult,
  UploadPointResponse,
  UploadProgress,
} from '@/features/data-management/api/dossierClient'
import { detectUploadPathConflicts } from '@/features/data-management/api/dossierClient'
import { UploadConflictDialog } from '@/features/data-management/components/UploadConflictDialog'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import type { OversizedUploadFile } from '@/features/data-management/lib/uploadParser'
import { resolveDossierIdsForUploadConflicts } from '@/features/data-management/lib/uploadFolderResolve'
import type { DataTreeNodeT } from '@/features/data-management/types'
import {
  dataManagementTreeQueryKey,
  useDeleteDataNodeMutation,
  useLoadNodeChildrenMutation,
  useRefreshDataManagementTreeMutation,
  useUploadDataFolderMutation,
} from '@/features/data-management/queries'
import { env } from '@/lib/utils/env'

type DialogPhase =
  | 'idle'
  | 'checking'
  | 'deleting'
  | 'uploading'
  | 'partial_error'
  | 'validation_error'

interface DialogState {
  phase: DialogPhase
  progress?: UploadProgress
  results?: Array<FileUploadResult>
  oversizedFiles?: Array<OversizedUploadFile>
}

interface PendingUpload {
  files: Array<File>
  uploadPoint: UploadPointResponse
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full bg-primary transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function FolderUploadDialog({
  open,
  onOpenChange,
  role,
  onUploadSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: DataManagementRole
  onUploadSuccess?: (result: UploadFolderResult) => void | Promise<void>
}) {
  const { t } = useTranslation('data-management')
  const { t: tCommon } = useTranslation('common')
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<DialogState>({ phase: 'idle' })
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null)
  const [conflictPaths, setConflictPaths] = useState<
    Array<{ relativePath: string; storageKey: string }>
  >([])
  const [conflictOpen, setConflictOpen] = useState(false)
  const [isConflictConfirming, setIsConflictConfirming] = useState(false)

  function handleProgress(p: UploadProgress) {
    setState((prev) => ({ ...prev, phase: 'uploading', progress: p }))
  }

  const mutation = useUploadDataFolderMutation(role, handleProgress)
  const deleteMutation = useDeleteDataNodeMutation(role)
  const loadChildrenMutation = useLoadNodeChildrenMutation(role)
  const refreshTreeMutation = useRefreshDataManagementTreeMutation(role)

  function clearInput() {
    if (inputRef.current) inputRef.current.value = ''
  }

  function resetPendingConflict() {
    setPendingUpload(null)
    setConflictPaths([])
    setConflictOpen(false)
  }

  function resetAndClose() {
    setState({ phase: 'idle' })
    resetPendingConflict()
    mutation.reset()
    onOpenChange(false)
  }

  function handleOpenChange(next: boolean) {
    if (
      !next &&
      (state.phase === 'uploading' ||
        state.phase === 'checking' ||
        state.phase === 'deleting')
    ) {
      return
    }
    if (!next) {
      setState({ phase: 'idle' })
      resetPendingConflict()
      mutation.reset()
    }
    onOpenChange(next)
  }

  function handleUploadError(err: unknown) {
    if (
      isDataManagementUploadError(err) &&
      err.code === 'fileTooLarge' &&
      err.details?.oversizedFiles?.length
    ) {
      setState({
        phase: 'validation_error',
        oversizedFiles: err.details.oversizedFiles,
      })
      return
    }

    setState({ phase: 'idle' })
    if (isDataManagementUploadError(err)) {
      toast.error(
        t(`upload.errors.${err.code}` as const, {
          maxSizeMb: env.DATA_UPLOAD_MAX_FILE_SIZE_MB,
        }),
      )
    } else {
      toast.error(tCommon('errors.default'))
    }
  }

  async function runUpload(
    files: Array<File>,
    options?: {
      uploadPoint?: UploadPointResponse
      allowOverwrite?: boolean
      overwriteFallback?: boolean
    },
  ) {
    try {
      const result = await mutation.mutateAsync({ files, ...options })
      const failed = result.results.filter((r) => r.status === 'error')
      const uploaded = result.results.filter((r) => r.status === 'uploaded')
      const skipped = result.results.filter((r) => r.status === 'skipped')

      if (failed.length > 0) {
        setState({ phase: 'partial_error', results: result.results })
        return
      }

      if (
        uploaded.length === 0 &&
        skipped.length > 0 &&
        options?.overwriteFallback &&
        !options.allowOverwrite
      ) {
        setState({ phase: 'uploading' })
        await runUpload(files, {
          uploadPoint: options.uploadPoint,
          allowOverwrite: true,
        })
        return
      }

      if (uploaded.length === 0 && skipped.length > 0) {
        toast.info(t('upload.allSkipped'))
        resetAndClose()
        return
      }

      toast.success(t('upload.success'))
      await onUploadSuccess?.(result)
      resetAndClose()
    } catch (err) {
      handleUploadError(err)
    } finally {
      clearInput()
    }
  }

  async function startUploadFlow(files: Array<File>) {
    setState({ phase: 'checking' })
    resetPendingConflict()

    try {
      validateFolderUploadFiles(files)
      const { conflicts, uploadPoint } = await detectUploadPathConflicts(files)

      if (conflicts.length > 0) {
        setPendingUpload({ files, uploadPoint })
        setConflictPaths(conflicts)
        setConflictOpen(true)
        setState({ phase: 'idle' })
        return
      }

      setState({ phase: 'uploading' })
      await runUpload(files, { uploadPoint })
    } catch (err) {
      handleUploadError(err)
      clearInput()
    }
  }

  async function handleChange(files: FileList | null) {
    if (!files?.length) return
    await startUploadFlow(Array.from(files))
  }

  async function handleConflictConfirm() {
    if (!pendingUpload || isConflictConfirming) return
    const { files, uploadPoint } = pendingUpload
    const conflicts = conflictPaths

    setIsConflictConfirming(true)
    setConflictOpen(false)
    setState({ phase: 'deleting' })

    try {
      let tree = queryClient.getQueryData<DataTreeNodeT>(
        dataManagementTreeQueryKey(role),
      )
      if (!tree) {
        tree = await refreshTreeMutation.mutateAsync(undefined)
      }

      const dossierIdMap = await resolveDossierIdsForUploadConflicts(
        conflicts,
        tree,
        (nodeId) => loadChildrenMutation.mutateAsync(nodeId).then((r) => r.tree),
      )

      const unresolvedCount = conflicts.filter(
        (conflict) => !dossierIdMap.has(conflict.storageKey),
      ).length
      if (unresolvedCount > 0) {
        toast.error(t('upload.conflict.unresolved', { count: unresolvedCount }))
        setState({ phase: 'idle' })
        setConflictPaths(conflicts)
        setConflictOpen(true)
        return
      }

      const uniqueDossierIds = [
        ...new Set(dossierIdMap.values()),
      ] as Array<string>

      for (const dossierId of uniqueDossierIds) {
        await deleteMutation.mutateAsync({
          target: 'dossier',
          id: dossierId,
          permanent: true,
        })
      }

      await queryClient.invalidateQueries({
        queryKey: dataManagementTreeQueryKey(role),
      })

      setConflictPaths([])
      setState({ phase: 'uploading' })
      await runUpload(files, { uploadPoint, overwriteFallback: true })
      setPendingUpload(null)
    } catch {
      toast.error(t('upload.conflict.deleteFailed'))
      setState({ phase: 'idle' })
      setConflictPaths(conflicts)
      setConflictOpen(true)
    } finally {
      setIsConflictConfirming(false)
    }
  }

  function handleConflictOpenChange(next: boolean) {
    if (!next) {
      resetPendingConflict()
      clearInput()
    }
    setConflictOpen(next)
  }

  async function handleRetry() {
    if (!state.results) return
    const failedFiles = state.results
      .filter((r) => r.status === 'error')
      .map((r) => r.file)
    setState({ phase: 'idle' })
    mutation.reset()
    await startUploadFlow(failedFiles)
  }

  const progress = state.progress
  const results = state.results ?? []
  const failedResults = results.filter((r) => r.status === 'error')
  const skippedCount = results.filter((r) => r.status === 'skipped').length
  const oversizedFiles = state.oversizedFiles ?? []
  const maxSizeMb = env.DATA_UPLOAD_MAX_FILE_SIZE_MB
  const isBusy =
    state.phase === 'checking' ||
    state.phase === 'deleting' ||
    state.phase === 'uploading' ||
    mutation.isPending ||
    isConflictConfirming

  function renderDialogHeader() {
    if (state.phase === 'validation_error') {
      return (
        <DialogHeader>
          <DialogTitle>{t('upload.validationError.title')}</DialogTitle>
          <DialogDescription>
            {t('upload.validationError.fileTooLargeDescription', { maxSizeMb })}
          </DialogDescription>
        </DialogHeader>
      )
    }

    if (state.phase === 'partial_error') {
      return (
        <DialogHeader>
          <DialogTitle>{t('upload.partialError.title')}</DialogTitle>
          <DialogDescription>
            {t('upload.partialError.description', {
              failed: failedResults.length,
              total: results.length,
            })}
          </DialogDescription>
        </DialogHeader>
      )
    }

    return (
      <DialogHeader>
        <DialogTitle>{t('upload.title')}</DialogTitle>
        {state.phase === 'idle' && (
          <DialogDescription>{t('upload.description')}</DialogDescription>
        )}
      </DialogHeader>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          {renderDialogHeader()}

          {state.phase === 'idle' && (
            <div className="flex flex-col gap-3">
              <input
                ref={(el) => {
                  inputRef.current = el
                  if (el) {
                    el.setAttribute('webkitdirectory', '')
                    el.setAttribute('directory', '')
                  }
                }}
                type="file"
                className="sr-only"
                multiple
                aria-hidden
                tabIndex={-1}
                onChange={(e) => void handleChange(e.target.files)}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={isBusy}
                onClick={() => inputRef.current?.click()}
              >
                {t('upload.pickFolder')}
              </Button>
            </div>
          )}

          {state.phase === 'checking' && (
            <div className="flex items-center gap-3 py-2">
              <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {t('upload.checking')}
              </p>
            </div>
          )}

          {state.phase === 'deleting' && (
            <div className="flex items-center gap-3 py-2">
              <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {t('upload.conflict.deleting')}
              </p>
            </div>
          )}

          {state.phase === 'uploading' && progress && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {progress.phase === 'preparing'
                  ? t('upload.progress.preparing')
                  : t('upload.progress.uploading', {
                      completed: progress.completed,
                      total: progress.total,
                    })}
              </p>
              <ProgressBar value={progress.completed} max={progress.total} />
              {progress.currentFile && (
                <p className="truncate text-xs text-muted-foreground">
                  {t('upload.progress.currentFile', {
                    name:
                      progress.currentFile.split('/').pop() ??
                      progress.currentFile,
                  })}
                </p>
              )}
            </div>
          )}

          {state.phase === 'validation_error' && oversizedFiles.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-muted/40 p-2">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {t('upload.validationError.oversizedFileLabel')}
                </p>
                <ul className="flex flex-col gap-1">
                  {oversizedFiles.map((file) => (
                    <li
                      key={file.relativePath}
                      className="flex items-start gap-2 text-xs text-foreground"
                    >
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {file.relativePath.split('/').pop() ??
                            file.relativePath}
                        </span>
                        <span className="block truncate text-muted-foreground">
                          {t('upload.validationError.fileSizeExceeded', {
                            maxSizeMb,
                          })}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {state.phase === 'partial_error' && (
            <div className="flex flex-col gap-3">
              {skippedCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('upload.partialError.skippedInfo', {
                    skipped: skippedCount,
                  })}
                </p>
              )}
              <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-muted/40 p-2">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {t('upload.partialError.failedFileLabel')}
                </p>
                <ul className="flex flex-col gap-1">
                  {failedResults.map((r) => (
                    <li
                      key={r.relativePath}
                      className="flex items-start gap-2 text-xs text-foreground"
                    >
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {r.relativePath.split('/').pop() ?? r.relativePath}
                        </span>
                        {r.error && (
                          <span className="block truncate text-muted-foreground">
                            {r.error}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <DialogFooter>
            {state.phase === 'idle' && (
              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() => handleOpenChange(false)}
              >
                {tCommon('common.cancel')}
              </Button>
            )}
            {(state.phase === 'partial_error' ||
              state.phase === 'validation_error') && (
              <Button type="button" variant="outline" onClick={resetAndClose}>
                {tCommon('common.close')}
              </Button>
            )}
            {state.phase === 'partial_error' && (
              <Button
                type="button"
                variant="default"
                disabled={mutation.isPending}
                onClick={() => void handleRetry()}
              >
                {t('upload.partialError.retryFailed')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UploadConflictDialog
        open={conflictOpen}
        onOpenChange={handleConflictOpenChange}
        conflicts={conflictPaths}
        onConfirm={handleConflictConfirm}
        isConfirming={isConflictConfirming}
      />
    </>
  )
}
