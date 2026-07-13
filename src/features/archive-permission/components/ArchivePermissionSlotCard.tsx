import { Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArchiveFondMultiSelect } from '@/features/archive-permission/components/ArchiveFondMultiSelect'
import { ARCHIVE_WAREHOUSE_PERMISSION_KEYS } from '@/features/archive-permission/constants'
import type { ArchivePermissionSlotT } from '@/features/archive-permission/types'
import type { ArchiveFondT } from '@/features/archive-fond/types'

interface ArchivePermissionSlotCardProps {
  slot: ArchivePermissionSlotT
  fonds: Array<ArchiveFondT>
  fondsLoading?: boolean
  disabled?: boolean
  onChange: (nextSlot: ArchivePermissionSlotT) => void
  onRename: () => void
  onDelete: () => void
}

const PERMISSION_LABEL_KEYS: Record<
  (typeof ARCHIVE_WAREHOUSE_PERMISSION_KEYS)[number],
  'slot.permissions.search' | 'slot.permissions.read' | 'slot.permissions.manage'
> = {
  'archive.warehouse.search': 'slot.permissions.search',
  'archive.warehouse.read': 'slot.permissions.read',
  'archive.warehouse.manage': 'slot.permissions.manage',
}

export function ArchivePermissionSlotCard({
  slot,
  fonds,
  fondsLoading,
  disabled,
  onChange,
  onRename,
  onDelete,
}: ArchivePermissionSlotCardProps) {
  const { t } = useTranslation('archive-permission')

  const togglePermission = (key: string, checked: boolean) => {
    const nextKeys = checked
      ? [...slot.permissionKeys, key]
      : slot.permissionKeys.filter((item) => item !== key)

    if (nextKeys.length === 0) return

    onChange({ ...slot, permissionKeys: nextKeys })
  }

  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-semibold">{slot.slotName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {slot.slotCode}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={disabled}
            onClick={onRename}
            aria-label={t('slot.rename')}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive"
            disabled={disabled}
            onClick={onDelete}
            aria-label={t('slot.delete')}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            {t('slot.permissionsLabel')}
          </Label>
          <div className="flex flex-wrap gap-4">
            {ARCHIVE_WAREHOUSE_PERMISSION_KEYS.map((key) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <Checkbox
                  checked={slot.permissionKeys.includes(key)}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    togglePermission(key, checked === true)
                  }
                />
                {t(PERMISSION_LABEL_KEYS[key])}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            {t('slot.fonds')}
          </Label>
          <ArchiveFondMultiSelect
            fonds={fonds}
            isLoading={fondsLoading}
            value={slot.fondIds}
            disabled={disabled}
            onValueChange={(fondIds) => onChange({ ...slot, fondIds })}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t('slot.code')}
            </Label>
            <Input
              value={slot.slotCode}
              disabled={disabled}
              onChange={(event) =>
                onChange({ ...slot, slotCode: event.target.value })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t('slot.name')}
            </Label>
            <Input
              value={slot.slotName}
              disabled={disabled}
              onChange={(event) =>
                onChange({ ...slot, slotName: event.target.value })
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
