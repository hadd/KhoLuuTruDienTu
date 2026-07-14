import { ImagePlus, Loader2, X } from 'lucide-react'
import { useRef, useState } from 'react'
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(item?.name ?? '')
  const [imageKey, setImageKey] = useState(item?.imageUrl ?? '')
  const [imagePreview, setImagePreview] = useState(
    item?.imageDisplayUrl ?? item?.imageUrl ?? '',
  )
  const [address, setAddress] = useState(item?.address ?? '')
  const [capacity, setCapacity] = useState(
    item?.capacity != null ? String(item.capacity) : '',
  )
  const [uploading, setUploading] = useState(false)

  const isPending = createItem.isPending || updateItem.isPending || uploading
  const showImage = mode.kind === 'location' || mode.isTopLevel
  const showAddress = mode.isTopLevel
  const showCapacity = mode.isBottomLevel

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
          ...(showImage ? { imageUrl: imageKey.trim() || null } : {}),
          ...(showAddress ? { address: address.trim() || null } : {}),
          ...(showCapacity ? { capacity: capacityValue } : {}),
        },
      })
    } else {
      await createItem.mutateAsync({
        parentId: mode.parentId,
        levelId: mode.levelId,
        name: trimmedName,
        imageUrl: showImage ? imageKey.trim() || null : null,
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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => {
                  void handleFileChange(e.target.files?.[0] ?? null)
                }}
              />
              {imagePreview ? (
                <div className="relative w-40 overflow-hidden rounded-md border">
                  <div className="aspect-square bg-muted">
                    <img
                      src={imagePreview}
                      alt={name || 'preview'}
                      className="size-full object-cover"
                    />
                  </div>
                  <div className="absolute right-1.5 top-1.5 flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="size-7"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <ImagePlus className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="size-7"
                      disabled={uploading}
                      onClick={clearImage}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <ImagePlus className="mr-2 size-4" />
                  )}
                  {uploading
                    ? t('form.fields.image.uploading')
                    : t('form.fields.image.choose')}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                {t('form.fields.image.hint')}
              </p>
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
