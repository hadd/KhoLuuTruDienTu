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
import { useUploadDataFolderMutation } from '@/features/data-management/queries'

type DialogPhase = 'idle' | 'checking' | 'uploading' | 'partial_error'

interface DialogState {
  phase: DialogPhase
  progress?: UploadProgress
  results?: Array<FileUploadResult>
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
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<DialogState>({ phase: 'idle' })
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null)
  const [conflictPaths, setConflictPaths] = useState<
    Array<{ relativePath: string; storageKey: string }>
  >([])
  const [conflictOpen, setConflictOpen] = useState(false)

  function handleProgress(p: UploadProgress) {
    setState((prev) => ({ ...prev, phase: 'uploading', progress: p }))
  }

  const mutation = useUploadDataFolderMutation(role, handleProgress)

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
    if (!next && (state.phase === 'uploading' || state.phase === 'checking')) {
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
    setState({ phase: 'idle' })
    if (isDataManagementUploadError(err)) {
      toast.error(t(`upload.errors.${err.code}` as const))
    } else {
      toast.error(tCommon('errors.default'))
    }
  }

  async function runUpload(
    files: Array<File>,
    options?: { uploadPoint?: UploadPointResponse; allowOverwrite?: boolean },
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
    if (!pendingUpload) return
    const { files, uploadPoint } = pendingUpload
    setConflictOpen(false)
    setConflictPaths([])
    setState({ phase: 'uploading' })
    await runUpload(files, { uploadPoint, allowOverwrite: true })
    setPendingUpload(null)
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
  const isBusy =
    state.phase === 'checking' ||
    state.phase === 'uploading' ||
    mutation.isPending

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('upload.title')}</DialogTitle>
            <DialogDescription>{t('upload.description')}</DialogDescription>
          </DialogHeader>

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

          {state.phase === 'partial_error' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-destructive">
                {t('upload.partialError.description', {
                  failed: failedResults.length,
                  total: results.length,
                })}
              </p>
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
            {state.phase === 'partial_error' && (
              <>
                <Button type="button" variant="outline" onClick={resetAndClose}>
                  {tCommon('common.close')}
                </Button>
                <Button
                  type="button"
                  variant="default"
                  disabled={mutation.isPending}
                  onClick={() => void handleRetry()}
                >
                  {t('upload.partialError.retryFailed')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UploadConflictDialog
        open={conflictOpen}
        onOpenChange={handleConflictOpenChange}
        conflicts={conflictPaths}
        onConfirm={handleConflictConfirm}
        isConfirming={mutation.isPending}
      />
    </>
  )
}
