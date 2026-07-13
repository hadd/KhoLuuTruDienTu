import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useDeletePhysicalWarehouseItem } from '@/features/physical-warehouse/queries'
import type { PhysicalWarehouseItemT } from '@/features/physical-warehouse/types'

interface ItemDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: PhysicalWarehouseItemT | null
}

export function ItemDeleteDialog({
  open,
  onOpenChange,
  item,
}: ItemDeleteDialogProps) {
  const { t } = useTranslation('physical-warehouse')
  const deleteItem = useDeletePhysicalWarehouseItem()

  async function handleDelete() {
    if (!item) return
    await deleteItem.mutateAsync(item.id)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('delete.confirmTitle')}</DialogTitle>
          <DialogDescription>
            {t('delete.confirmDescription', { name: item?.name ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteItem.isPending}
          >
            {t('delete.cancelButton')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleDelete()}
            disabled={deleteItem.isPending || !item}
          >
            {deleteItem.isPending
              ? t('delete.deleting')
              : t('delete.confirmButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
