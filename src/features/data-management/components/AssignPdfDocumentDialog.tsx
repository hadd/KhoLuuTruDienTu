import { AlertCircle, FileText, Loader2, Upload } from 'lucide-react'
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
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { useAssignPdfDocumentMutation } from '@/features/data-management/queries'
import type { DataTreeNodeT } from '@/features/data-management/types'
import type { UploadProgress } from '@/features/data-management/api/dossierClient'
import { formatFileSize } from '@/lib/utils/format'

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

export function AssignPdfDocumentDialog({
  open,
  onOpenChange,
  role,
  projectCode,
  targetNode,
  onAssignSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: DataManagementRole
  projectCode?: string
  targetNode?: DataTreeNodeT | null
  onAssignSuccess?: () => void | Promise<void>
}) {
  const { t } = useTranslation('data-management')
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<UploadProgress | null>(null)

  const mutation = useAssignPdfDocumentMutation(
    role,
    projectCode,
    (p) => setProgress(p),
  )

  function clearState() {
    setSelectedFile(null)
    setProgress(null)
    if (inputRef.current) inputRef.current.value = ''
    mutation.reset()
  }

  function handleOpenChange(next: boolean) {
    if (!next && mutation.isPending) return
    if (!next) clearState()
    onOpenChange(next)
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error(t('assignDocument.errors.notPdf', 'Chỉ chấp nhận file định dạng PDF'))
      return
    }
    setSelectedFile(file)
  }

  async function handleAssign() {
    if (!targetNode || !selectedFile) return

    try {
      await mutation.mutateAsync({
        oldNode: targetNode,
        file: selectedFile,
        runMode: 'auto',
      })

      toast.success(
        t('assignDocument.success', {
          oldName: targetNode.name,
          newName: selectedFile.name,
          defaultValue: `Đã thay thế tài liệu "${targetNode.name}" bằng "${selectedFile.name}" thành công!`,
        }),
      )

      await onAssignSuccess?.()
      handleOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t('assignDocument.error', 'Thay tài liệu thất bại'),
      )
    }
  }

  if (!targetNode) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('assignDocument.title', 'Thay thế tài liệu (File PDF)')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'assignDocument.description',
              'Chọn file PDF mới để thay thế vị trí tài liệu hiện tại trong hệ thống.',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target File Info */}
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="text-xs font-medium text-muted-foreground">
              {t('assignDocument.targetFile', 'Tài liệu bị thay thế (xóa ngầm):')}
            </div>
            <div className="mt-1 flex items-center gap-2 font-medium">
              <FileText className="size-4 shrink-0 text-red-500" />
              <span className="truncate">{targetNode.name}</span>
              <span className="text-xs text-muted-foreground">
                ({formatFileSize(targetNode.sizeBytes)})
              </span>
            </div>
          </div>

          {/* New File Input */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t('assignDocument.selectNewFile', 'Chọn file PDF mới thế vị trí:')}
            </label>
            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-4 text-center transition-colors hover:bg-accent/50"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-8 text-muted-foreground mb-1" />
              {selectedFile ? (
                <div className="text-sm font-medium text-primary truncate max-w-full">
                  {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  {t('assignDocument.dragDropHint', 'Nhấp để chọn file PDF mới')}
                </div>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </div>



          {/* Uploading Progress */}
          {mutation.isPending && (
            <div className="space-y-2 rounded-lg bg-muted/60 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <Loader2 className="size-3.5 animate-spin" />
                  {t('assignDocument.processing', 'Đang xóa file cũ và gán file mới...')}
                </span>
                {progress && (
                  <span>
                    {progress.completed} / {progress.total}
                  </span>
                )}
              </div>
              {progress && <ProgressBar value={progress.completed} max={progress.total} />}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={mutation.isPending}
          >
            {t('common:actions.cancel', 'Hủy')}
          </Button>
          <Button
            type="button"
            onClick={handleAssign}
            disabled={!selectedFile || mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            {t('assignDocument.confirmButton', 'Thực hiện thay tài liệu')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
