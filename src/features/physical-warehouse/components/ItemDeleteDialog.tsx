import { useQueryClient } from '@tanstack/react-query'
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
import { reparentPhysicalWarehouseItem } from '@/features/physical-warehouse/api/physicalWarehouseClient'
import {
  physicalWarehouseQueryKeyPrefix,
  useDeletePhysicalWarehouseItem,
} from '@/features/physical-warehouse/queries'
import type { PhysicalWarehouseItemT } from '@/features/physical-warehouse/types'
import { translateError } from '@/lib/utils/translate-error'

interface ItemDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: PhysicalWarehouseItemT | null
  onDeleted?: (item: PhysicalWarehouseItemT) => void
  moveStorageUnitsUp?: {
    storageUnitIds: Array<string>
    targetParentId: string
  } | null
}

export function ItemDeleteDialog({
  open,
  onOpenChange,
  item,
  onDeleted,
  moveStorageUnitsUp = null,
}: ItemDeleteDialogProps) {
  const { t } = useTranslation('physical-warehouse')
  const deleteItem = useDeletePhysicalWarehouseItem()
  const queryClient = useQueryClient()

  async function handleDelete() {
    if (!item) return

    try {
      if (moveStorageUnitsUp && moveStorageUnitsUp.storageUnitIds.length > 0) {
        for (const storageUnitId of moveStorageUnitsUp.storageUnitIds) {
          await reparentPhysicalWarehouseItem(
            storageUnitId,
            moveStorageUnitsUp.targetParentId,
          )
        }
        void queryClient.invalidateQueries({
          queryKey: physicalWarehouseQueryKeyPrefix,
        })
      }

      await deleteItem.mutateAsync(item.id)
      onDeleted?.(item)
      onOpenChange(false)
    } catch (error) {
      toast.error(translateError(error))
    }
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
