import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ArchivePermissionSlotCard } from '@/features/archive-permission/components/ArchivePermissionSlotCard'
import type { ArchivePermissionSlotT } from '@/features/archive-permission/types'
import type { ArchiveFondT } from '@/features/archive-fond/types'

interface ArchivePermissionSlotListProps {
  slots: Array<ArchivePermissionSlotT>
  fonds: Array<ArchiveFondT>
  fondsLoading?: boolean
  disabled?: boolean
  onSlotsChange: (slots: Array<ArchivePermissionSlotT>) => void
  onAddSlot: () => void
  onRenameSlot: (slot: ArchivePermissionSlotT) => void
  onDeleteSlot: (slot: ArchivePermissionSlotT) => void
}

export function ArchivePermissionSlotList({
  slots,
  fonds,
  fondsLoading,
  disabled,
  onSlotsChange,
  onAddSlot,
  onRenameSlot,
  onDeleteSlot,
}: ArchivePermissionSlotListProps) {
  const { t } = useTranslation('archive-permission')

  const updateSlot = (index: number, nextSlot: ArchivePermissionSlotT) => {
    const next = [...slots]
    next[index] = nextSlot
    onSlotsChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{t('detail.slotsTitle')}</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onAddSlot}
        >
          <Plus className="size-4" />
          {t('detail.addSlot')}
        </Button>
      </div>

      {slots.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {t('detail.addSlot')}
        </p>
      ) : (
        <div className="space-y-3">
          {slots.map((slot, index) => (
            <ArchivePermissionSlotCard
              key={slot.slotCode}
              slot={slot}
              fonds={fonds}
              fondsLoading={fondsLoading}
              disabled={disabled}
              onChange={(nextSlot) => updateSlot(index, nextSlot)}
              onRename={() => onRenameSlot(slot)}
              onDelete={() => onDeleteSlot(slot)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
