import { useRef } from 'react'
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
  DataManagementUploadError,
} from '@/features/data-management/api/dataManagementClient'
import { useUploadDataFolderMutation } from '@/features/data-management/queries'

export function FolderUploadDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation('data-management')
  const { t: tCommon } = useTranslation('common')
  const inputRef = useRef<HTMLInputElement>(null)
  const mutation = useUploadDataFolderMutation()

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
  }

  async function handleChange(files: FileList | null) {
    if (!files?.length) return
    const list = Array.from(files)
    try {
      await mutation.mutateAsync(list)
      toast.success(t('upload.success'))
      handleOpenChange(false)
    } catch (err) {
      if (err instanceof DataManagementUploadError) {
        toast.error(t(`upload.errors.${err.code}` as const))
      } else {
        toast.error(tCommon('errors.default'))
      }
    } finally {
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('upload.title')}</DialogTitle>
          <DialogDescription>{t('upload.description')}</DialogDescription>
        </DialogHeader>
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
            disabled={mutation.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {t('upload.pickFolder')}
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {tCommon('common.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
