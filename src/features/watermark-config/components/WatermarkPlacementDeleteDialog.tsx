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
import { useDeleteWatermarkPlacement } from '@/features/watermark-config/queries'
import type { WatermarkPlacementSummaryT } from '@/features/watermark-config/types'

type WatermarkPlacementDeleteDialogProps = {
  placement: WatermarkPlacementSummaryT | null
  onOpenChange: (open: boolean) => void
}

export function WatermarkPlacementDeleteDialog({
  placement,
  onOpenChange,
}: WatermarkPlacementDeleteDialogProps) {
  const { t } = useTranslation('watermark-config')
  const deleteMutation = useDeleteWatermarkPlacement()

  return (
    <AlertDialog
      open={Boolean(placement)}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('delete.confirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('delete.confirmDescription', { name: placement?.name ?? '' })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            {t('delete.cancelButton')}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={!placement || deleteMutation.isPending}
            onClick={(event) => {
              event.preventDefault()
              if (!placement) return
              void deleteMutation.mutateAsync(placement.id).then(() => {
                onOpenChange(false)
              })
            }}
          >
            {t('delete.confirmButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
