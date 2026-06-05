import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { UploadPathConflict } from '@/features/data-management/api/dossierClient'

export function UploadConflictDialog({
  open,
  onOpenChange,
  conflicts,
  onConfirm,
  isConfirming,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflicts: Array<UploadPathConflict>
  onConfirm: () => void | Promise<void>
  isConfirming?: boolean
}) {
  const { t } = useTranslation('data-management')
  const { t: tCommon } = useTranslation('common')

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('upload.conflict.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('upload.conflict.description', { count: conflicts.length })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-muted/40 p-2">
          <ul className="flex flex-col gap-1">
            {conflicts.map((item) => (
              <li
                key={item.storageKey}
                className="truncate text-xs text-foreground"
                title={item.relativePath}
              >
                {item.relativePath}
              </li>
            ))}
          </ul>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isConfirming}>
            {tCommon('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isConfirming}
            onClick={(e) => {
              e.preventDefault()
              void onConfirm()
            }}
          >
            {t('upload.conflict.continue')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
