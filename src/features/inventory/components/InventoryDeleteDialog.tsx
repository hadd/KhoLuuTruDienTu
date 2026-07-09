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
import { useDeleteInventory } from '@/features/inventory/queries'
import type { InventoryT } from '@/features/inventory/types'

interface InventoryDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  inventory: InventoryT | null
}

export function InventoryDeleteDialog({
  open,
  onOpenChange,
  inventory,
}: InventoryDeleteDialogProps) {
  const { t } = useTranslation('inventory')
  const deleteInventory = useDeleteInventory()

  if (!inventory) return null

  const handleDelete = () => {
    deleteInventory.mutate(inventory.id, {
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
            {t('delete.confirmDescription', { name: inventory.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteInventory.isPending}>
            {t('delete.cancelButton')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              handleDelete()
            }}
            disabled={deleteInventory.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteInventory.isPending
              ? t('delete.deleting')
              : t('delete.confirmButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
