import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useCreatePhysicalWarehouseItem,
  useUpdatePhysicalWarehouseItem,
} from '@/features/physical-warehouse/queries'
import type { PhysicalWarehouseItemT } from '@/features/physical-warehouse/types'

export type ItemFormMode = {
  kind: 'location' | 'level'
  isTopLevel: boolean
  isBottomLevel: boolean
  levelId: string | null
  parentId: string | null
  levelLabel: string
}

interface ItemFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: ItemFormMode
  item: PhysicalWarehouseItemT | null
}

export function ItemFormDialog({
  open,
  onOpenChange,
  mode,
  item,
}: ItemFormDialogProps) {
  const { t } = useTranslation('physical-warehouse')
  const createItem = useCreatePhysicalWarehouseItem()
  const updateItem = useUpdatePhysicalWarehouseItem()
  const isEdit = item !== null

  const [name, setName] = useState(item?.name ?? '')
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? '')
  const [address, setAddress] = useState(item?.address ?? '')
  const [capacity, setCapacity] = useState(
    item?.capacity != null ? String(item.capacity) : '',
  )

  const isPending = createItem.isPending || updateItem.isPending
  const showImage = mode.kind === 'location' || mode.isTopLevel
  const showAddress = mode.isTopLevel
  const showCapacity = mode.isBottomLevel

  const title = mode.kind === 'location'
    ? isEdit
      ? t('form.editLocationTitle')
      : t('form.createLocationTitle')
    : isEdit
      ? t('form.editTitle', { level: mode.levelLabel })
      : t('form.createTitle', { level: mode.levelLabel })

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return

    if (showCapacity && capacity.trim() === '') {
      return
    }

    const capacityValue = showCapacity ? Number(capacity) : null
    if (showCapacity && (Number.isNaN(capacityValue) || capacityValue! < 0)) {
      return
    }

    if (item) {
      await updateItem.mutateAsync({
        id: item.id,
        payload: {
          name: trimmedName,
          ...(showImage
            ? { imageUrl: imageUrl.trim() || null }
            : {}),
          ...(showAddress
            ? { address: address.trim() || null }
            : {}),
          ...(showCapacity ? { capacity: capacityValue } : {}),
        },
      })
    } else {
      await createItem.mutateAsync({
        parentId: mode.parentId,
        levelId: mode.levelId,
        name: trimmedName,
        imageUrl: showImage ? imageUrl.trim() || null : null,
        address: showAddress ? address.trim() || null : null,
        capacity: showCapacity ? capacityValue : null,
      })
    }

    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onOpenChange(false)
        else {
          setName(item?.name ?? '')
          setImageUrl(item?.imageUrl ?? '')
          setAddress(item?.address ?? '')
          setCapacity(item?.capacity != null ? String(item.capacity) : '')
          onOpenChange(true)
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <div className="space-y-2">
            <Label htmlFor="pw-name">{t('form.fields.name.label')}</Label>
            <Input
              id="pw-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('form.fields.name.placeholder')}
              required
            />
          </div>

          {showImage ? (
            <div className="space-y-2">
              <Label htmlFor="pw-image">
                {t('form.fields.imageUrl.label')}
              </Label>
              <Input
                id="pw-image"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder={t('form.fields.imageUrl.placeholder')}
              />
            </div>
          ) : null}

          {showAddress ? (
            <div className="space-y-2">
              <Label htmlFor="pw-address">
                {t('form.fields.address.label')}
              </Label>
              <Input
                id="pw-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t('form.fields.address.placeholder')}
              />
            </div>
          ) : null}

          {showCapacity ? (
            <div className="space-y-2">
              <Label htmlFor="pw-capacity">
                {t('form.fields.capacity.label')}
              </Label>
              <Input
                id="pw-capacity"
                type="number"
                min={0}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder={t('form.fields.capacity.placeholder')}
                required
              />
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t('form.actions.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? t('form.actions.saving')
                : isEdit
                  ? t('form.actions.update')
                  : t('form.actions.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
