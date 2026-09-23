import { AlertCircle } from 'lucide-react'
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

export function ConfirmApproveNamingDialog({
  open,
  onOpenChange,
  onConfirm,
  isApproving,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  isApproving?: boolean
}) {
  const { t } = useTranslation('data-management')
  const { t: tCommon } = useTranslation('common')

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertCircle
              className="size-5 shrink-0 text-amber-500"
              aria-hidden
            />
            <AlertDialogTitle>
              {t('metadata.confirmApproveNamingTitle')}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-2 pt-2 text-sm leading-relaxed text-muted-foreground">
            <span>{t('metadata.confirmApproveNamingDesc')}</span>
            <span className="block mt-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
              {t('metadata.confirmApproveNamingNotice')}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isApproving}>
            {tCommon('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isApproving}
            onClick={(e) => {
              e.preventDefault()
              void onConfirm()
            }}
          >
            {t('metadata.confirmApproveNamingAction')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
