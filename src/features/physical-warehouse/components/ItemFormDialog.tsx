import { ImagePlus, Loader2, X } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
import { uploadPhysicalWarehouseImage } from '@/features/physical-warehouse/api/physicalWarehouseClient'
import {
  useCreatePhysicalWarehouseItem,
  useUpdatePhysicalWarehouseItem,
} from '@/features/physical-warehouse/queries'
import type { PhysicalWarehouseItemT } from '@/features/physical-warehouse/types'
import { translateError } from '@/lib/utils/translate-error'

export type ItemFormMode = {
  kind: 'location' | 'warehouse' | 'intermediate' | 'storageUnit'
  parentId: string | null
  levelLabel: string
  /** When creating intermediate: storage units to reparent into the new node. */
  storageUnitIdsToMove?: string[]
}

interface ItemFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: ItemFormMode
  item: PhysicalWarehouseItemT | null
  onCreated?: (record: PhysicalWarehouseItemT) => Promise<void>
}

export function ItemFormDialog({
  open,
  onOpenChange,
  mode,
  item,
  onCreated,
}: ItemFormDialogProps) {
  const { t } = useTranslation('physical-warehouse')
  const createItem = useCreatePhysicalWarehouseItem()
  const updateItem = useUpdatePhysicalWarehouseItem()
  const isEdit = item !== null
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(item?.name ?? '')
  const [imageKey, setImageKey] = useState(item?.imageUrl ?? '')
  const [imagePreview, setImagePreview] = useState(
    item?.imageDisplayUrl ?? item?.imageUrl ?? '',
  )
  const [address, setAddress] = useState(item?.address ?? '')
  const [mapsUrl, setMapsUrl] = useState(item?.mapsUrl ?? '')
  const [capacity, setCapacity] = useState(
    item?.capacity != null ? String(item.capacity) : '',
  )
  const [uploading, setUploading] = useState(false)

  const isPending = createItem.isPending || updateItem.isPending || uploading
  const showImage = mode.kind === 'location' || mode.kind === 'warehouse'
  const showAddress = mode.kind === 'warehouse'
  const showCapacity = mode.kind === 'storageUnit'

  const title =
    mode.kind === 'location'
      ? isEdit
        ? t('form.editLocationTitle')
        : t('form.createLocationTitle')
      : isEdit
        ? t('form.editTitle', { level: mode.levelLabel })
        : t('form.createTitle', { level: mode.levelLabel })

  function resetFromItem(nextItem: PhysicalWarehouseItemT | null) {
    setName(nextItem?.name ?? '')
    setImageKey(nextItem?.imageUrl ?? '')
    setImagePreview(nextItem?.imageDisplayUrl ?? nextItem?.imageUrl ?? '')
    setAddress(nextItem?.address ?? '')
    setMapsUrl(nextItem?.mapsUrl ?? '')
    setCapacity(nextItem?.capacity != null ? String(nextItem.capacity) : '')
  }

  async function handleFileChange(file: File | null) {
    if (!file) return
    setUploading(true)
    try {
      const result = await uploadPhysicalWarehouseImage(file)
      setImageKey(result.imageUrl)
      setImagePreview(result.imageDisplayUrl ?? URL.createObjectURL(file))
      toast.success(t('form.fields.image.uploadSuccess'))
    } catch (error) {
      toast.error(translateError(error))
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  function clearImage() {
    setImageKey('')
    setImagePreview('')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return

    if (showCapacity && capacity.trim() === '') {
      return
    }

    const capacityValue = showCapacity ? Number(capacity) : null
    if (showCapacity && (Number.isNaN(capacityValue) || capacityValue! < 0)) {
      toast.error(t('form.fields.capacity.invalid'))
      return
    }

    const minCapacity = item?.usedCapacity ?? 0
    if (
      showCapacity &&
      isEdit &&
      capacityValue != null &&
      capacityValue < minCapacity
    ) {
      toast.error(
        t('form.fields.capacity.minUsed', { used: minCapacity }),
      )
      return
    }

    if (item) {
      await updateItem.mutateAsync({
        id: item.id,
        payload: {
          name: trimmedName,
          ...(showImage ? { imageUrl: imageKey.trim() || null } : {}),
          ...(showAddress ? { address: address.trim() || null } : {}),
          ...(showAddress ? { mapsUrl: mapsUrl.trim() || null } : {}),
          ...(showCapacity ? { capacity: capacityValue } : {}),
        },
      })
    } else {
      const created = await createItem.mutateAsync({
        parentId: mode.parentId,
        name: trimmedName,
        imageUrl: showImage ? imageKey.trim() || null : null,
        address: showAddress ? address.trim() || null : null,
        mapsUrl: showAddress ? mapsUrl.trim() || null : null,
        capacity: showCapacity ? capacityValue : null,
      })
      if (onCreated) {
        await onCreated(created)
      }
    }

    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onOpenChange(false)
        else {
          resetFromItem(item)
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
              <Label>{t('form.fields.image.label')}</Label>
              <div className="flex items-start gap-3">
                <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <ImagePlus className="size-6 text-muted-foreground opacity-50" />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      void handleFileChange(e.target.files?.[0] ?? null)
                    }
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? (
                        <Loader2 className="mr-1 size-4 animate-spin" />
                      ) : (
                        <ImagePlus className="mr-1 size-4" />
                      )}
                      {t('form.fields.image.choose')}
                    </Button>
                    {imagePreview ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={clearImage}
                      >
                        <X className="mr-1 size-4" />
                        {t('form.fields.image.clear')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
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

          {showAddress ? (
            <div className="space-y-2">
              <Label htmlFor="pw-maps-url">
                {t('form.fields.mapsUrl.label')}
              </Label>
              <Input
                id="pw-maps-url"
                type="url"
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                placeholder={t('form.fields.mapsUrl.placeholder')}
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
              {isEdit && (item?.usedCapacity ?? 0) > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t('form.fields.capacity.minUsedHint', {
                    used: item?.usedCapacity ?? 0,
                  })}
                </p>
              ) : null}
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
              {isPending ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : null}
              {isEdit ? t('form.actions.update') : t('form.actions.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
