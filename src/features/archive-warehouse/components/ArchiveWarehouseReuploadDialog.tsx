import { useMutation } from '@tanstack/react-query'
import { Loader2, Upload } from 'lucide-react'
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
  createArchiveWarehouseReuploadUploadPoint,
  reuploadArchiveWarehouseFile,
  uploadFileToWarehouseReuploadPoint,
} from '@/features/archive-warehouse/api/archiveWarehouseClient'
import { translateError } from '@/lib/utils/translate-error'

type ArchiveWarehouseReuploadDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  dossierId: string
  fileId: string
  fileName: string
}

type Mode = 'choose' | 'uploading'

export function ArchiveWarehouseReuploadDialog({
  open,
  onOpenChange,
  dossierId,
  fileId,
  fileName,
}: ArchiveWarehouseReuploadDialogProps) {
  const { t } = useTranslation('archive-warehouse')
  const inputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>('choose')

  const mutation = useMutation({
    mutationFn: async (key?: string) =>
      reuploadArchiveWarehouseFile(dossierId, fileId, key ? { key } : undefined),
    onSuccess: (result) => {
      toast.success(result.message || t('reupload.success'))
      onOpenChange(false)
      setMode('choose')
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? translateError(error) : t('reupload.failed'),
      )
      setMode('choose')
    },
  })

  async function handleReuseCurrent() {
    setMode('uploading')
    mutation.mutate(undefined)
  }

  async function handlePickNew(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return

    setMode('uploading')
    try {
      const uploadPoint = await createArchiveWarehouseReuploadUploadPoint(
        dossierId,
        fileId,
      )
      const key = await uploadFileToWarehouseReuploadPoint(file, uploadPoint)
      mutation.mutate(key)
    } catch (error) {
      toast.error(
        error instanceof Error ? translateError(error) : t('reupload.failed'),
      )
      setMode('choose')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending || mode === 'uploading') return
        onOpenChange(next)
        if (!next) setMode('choose')
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('reupload.title')}</DialogTitle>
          <DialogDescription>
            {t('reupload.description', { fileName })}
          </DialogDescription>
        </DialogHeader>

        {mode === 'uploading' || mutation.isPending ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            {t('reupload.processing')}
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{t('reupload.pipelineHint')}</p>
            <Button
              type="button"
              className="w-full justify-start gap-2"
              onClick={() => void handleReuseCurrent()}
            >
              <Upload className="size-4" aria-hidden />
              {t('reupload.useCurrent')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-4" aria-hidden />
              {t('reupload.pickNew')}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(event) => {
                void handlePickNew(event.target.files)
                event.target.value = ''
              }}
            />
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending || mode === 'uploading'}
            onClick={() => onOpenChange(false)}
          >
            {t('reupload.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
