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
  validateDocumentUploadFiles,
} from '@/features/data-management/api/dataManagementClient'
import type {
  FileUploadResult,
  UploadFolderResult,
  UploadPointResponse,
  UploadProgress,
} from '@/features/data-management/api/dossierClient'
import { detectUploadPathConflicts } from '@/features/data-management/api/dossierClient'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { resolveUploadFlowErrorMessage } from '@/features/data-management/lib/uploadFlowHelpers'
import type { OversizedUploadFile } from '@/features/data-management/lib/uploadParser'
import { resolveRecordStoragePrefix } from '@/features/data-management/lib/uploadPathPrefix'
import { useUploadDataDocumentsMutation } from '@/features/data-management/queries'
import type { DataTreeNodeT } from '@/features/data-management/types'
import { env } from '@/lib/utils/env'

type DialogPhase =
  | 'idle'
  | 'checking'
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

export function DocumentUploadDialog({
  open,
  onOpenChange,
  role,
  projectCode,
  targetRecord,
  onUploadSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: DataManagementRole
  projectCode?: string
  targetRecord?: DataTreeNodeT | null
  onUploadSuccess?: (result: UploadFolderResult) => void | Promise<void>
}) {
  const { t } = useTranslation('data-management')
  const { t: tCommon } = useTranslation('common')
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<DialogState>({ phase: 'idle' })
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null)
  const [conflictPaths, setConflictPaths] = useState<
    Array<{ relativePath: string; storageKey: string }>
  >([])
  const [overwriteOpen, setOverwriteOpen] = useState(false)

  const storagePathPrefix = targetRecord
    ? resolveRecordStoragePrefix(targetRecord)
    : undefined
  const isMissingRecordPath = Boolean(targetRecord) && !storagePathPrefix

  function handleProgress(p: UploadProgress) {
    setState((prev) => ({ ...prev, phase: 'uploading', progress: p }))
  }

  const mutation = useUploadDataDocumentsMutation(
    role,
    projectCode,
    handleProgress,
  )

  function clearInput() {
    if (inputRef.current) inputRef.current.value = ''
  }

  function resetPendingOverwrite() {
    setPendingUpload(null)
    setConflictPaths([])
    setOverwriteOpen(false)
  }

  function resetAndClose() {
    setState({ phase: 'idle' })
    resetPendingOverwrite()
    mutation.reset()
    onOpenChange(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next && (state.phase === 'uploading' || state.phase === 'checking')) {
      return
    }
    if (!next) {
      setState({ phase: 'idle' })
      resetPendingOverwrite()
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
    toast.error(
      resolveUploadFlowErrorMessage(err, {
        translateUploadError: (code) =>
          t(`upload.errors.${code}` as const, {
            maxSizeMb: env.DATA_UPLOAD_MAX_FILE_SIZE_MB,
          }),
        defaultMessage: t('upload.errors.requestFailed'),
      }),
    )
  }

  async function runUpload(
    files: Array<File>,
    options?: {
      uploadPoint?: UploadPointResponse
      allowOverwrite?: boolean
    },
  ) {
    try {
      const result = await mutation.mutateAsync({
        files,
        storagePathPrefix,
        skipPathCheck: true,
        ...options,
      })
      const failed = result.results.filter((r) => r.status === 'error')
      const uploaded = result.results.filter((r) => r.status === 'uploaded')
      const skipped = result.results.filter((r) => r.status === 'skipped')

      if (failed.length > 0) {
        setState({ phase: 'partial_error', results: result.results })
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
    if (isMissingRecordPath) {
      toast.error(t('upload.errors.missingFolderPath'))
      clearInput()
      return
    }

    setState({ phase: 'checking' })
    resetPendingOverwrite()

    try {
      validateDocumentUploadFiles(files)
      const { conflicts, uploadPoint } = await detectUploadPathConflicts(
        files,
        {
          storagePathPrefix,
        },
      )

      if (conflicts.length > 0) {
        setPendingUpload({ files, uploadPoint })
        setConflictPaths(conflicts)
        setOverwriteOpen(true)
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
    if (!files?.length) {
      toast.error(t('upload.errors.noFilesSelected'))
      return
    }
    await startUploadFlow(Array.from(files))
  }

  async function handleOverwriteConfirm() {
    if (!pendingUpload) return
    const { files, uploadPoint } = pendingUpload

    setOverwriteOpen(false)
    setConflictPaths([])
    setState({ phase: 'uploading' })
    setPendingUpload(null)

    await runUpload(files, { uploadPoint, allowOverwrite: true })
  }

  function handleOverwriteOpenChange(next: boolean) {
    if (!next) {
      resetPendingOverwrite()
      clearInput()
    }
    setOverwriteOpen(next)
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
    state.phase === 'uploading' ||
    mutation.isPending

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
        <DialogTitle>{t('upload.documentTitle')}</DialogTitle>
        {state.phase === 'idle' && (
          <DialogDescription>
            {targetRecord
              ? t('upload.toRecord', { name: targetRecord.name })
              : t('upload.documentDescription')}
          </DialogDescription>
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
              {isMissingRecordPath && (
                <p className="text-sm text-destructive">
                  {t('upload.errors.missingFolderPath')}
                </p>
              )}
              <input
                ref={inputRef}
                type="file"
                className="sr-only"
                accept=".pdf,application/pdf"
                multiple
                aria-hidden
                tabIndex={-1}
                onChange={(e) => void handleChange(e.target.files)}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={isBusy || isMissingRecordPath}
                onClick={() => inputRef.current?.click()}
              >
                {t('upload.pickFiles')}
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

      <Dialog open={overwriteOpen} onOpenChange={handleOverwriteOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('upload.overwriteWarning.title')}</DialogTitle>
            <DialogDescription>
              {t('upload.overwriteWarning.description', {
                count: conflictPaths.length,
              })}
            </DialogDescription>
          </DialogHeader>

          {conflictPaths.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted/40 p-2">
              <ul className="flex flex-col gap-1">
                {conflictPaths.map((conflict) => (
                  <li
                    key={conflict.storageKey}
                    className="truncate text-xs text-foreground"
                  >
                    {conflict.relativePath.split('/').pop() ??
                      conflict.relativePath}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => handleOverwriteOpenChange(false)}
            >
              {tCommon('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="default"
              disabled={mutation.isPending}
              onClick={() => void handleOverwriteConfirm()}
            >
              {t('upload.overwriteWarning.continue')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
