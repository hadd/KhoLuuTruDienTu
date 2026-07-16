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
import { useDeleteRetentionPeriod } from '@/features/retention-period/queries'
import { formatRetentionDurationLabel } from '@/features/retention-period/lib/formatRetentionDuration'
import type { RetentionPeriodT } from '@/features/retention-period/types'

interface RetentionPeriodDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  period: RetentionPeriodT | null
}

export function RetentionPeriodDeleteDialog({
  open,
  onOpenChange,
  period,
}: RetentionPeriodDeleteDialogProps) {
  const { t } = useTranslation('retention-period')
  const deletePeriod = useDeleteRetentionPeriod()

  if (!period) return null

  const handleDelete = () => {
    deletePeriod.mutate(period.id, {
      onSuccess: () => {
        onOpenChange(false)
      },
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('delete.confirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('delete.confirmDescription', {
              name: formatRetentionDurationLabel(period, t),
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletePeriod.isPending}>
            {t('delete.cancelButton')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              handleDelete()
            }}
            disabled={deletePeriod.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deletePeriod.isPending
              ? t('delete.deleting')
              : t('delete.confirmButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
