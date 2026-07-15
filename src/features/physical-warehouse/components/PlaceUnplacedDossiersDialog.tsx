import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getUnplacedWarehouseDossiers,
  placeWarehouseDossier,
} from '@/features/physical-warehouse/api/physicalWarehouseClient'
import { translateError } from '@/lib/utils/translate-error'

interface PlaceUnplacedDossiersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  physicalItemId: string
  boxName?: string
  remainingCapacity: number | null
}

export function PlaceUnplacedDossiersDialog({
  open,
  onOpenChange,
  physicalItemId,
  boxName,
  remainingCapacity,
}: PlaceUnplacedDossiersDialogProps) {
  const { t } = useTranslation('physical-warehouse')
  const queryClient = useQueryClient()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const unplacedQuery = useQuery({
    queryKey: ['physical-warehouse', 'unplaced-dossiers'],
    queryFn: () => getUnplacedWarehouseDossiers({ page: 1, limit: 100 }),
    enabled: open,
    staleTime: 10_000,
  })

  const maxSelectable = remainingCapacity == null ? 0 : remainingCapacity

  const items = unplacedQuery.data?.items ?? []

  const selectableCount = useMemo(() => {
    if (maxSelectable <= 0) return 0
    return Math.min(items.length, maxSelectable)
  }, [items.length, maxSelectable])

  const placeMutation = useMutation({
    mutationFn: async (dossierIds: Array<string>) => {
      for (const dossierId of dossierIds) {
        await placeWarehouseDossier({
          dossierId,
          physicalItemId,
        })
      }
    },
    onSuccess: (_data, dossierIds) => {
      toast.success(
        t('manage.placeSuccess', { count: dossierIds.length }),
      )
      void queryClient.invalidateQueries({
        queryKey: ['physical-warehouse'],
      })
      setSelectedIds(new Set())
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(translateError(error) || String(error.message))
      void queryClient.invalidateQueries({
        queryKey: ['physical-warehouse'],
      })
    },
  })

  function toggle(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        if (next.size >= maxSelectable) {
          toast.error(
            t('manage.placeExceedCapacity', { remaining: maxSelectable }),
          )
          return prev
        }
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSelectedIds(new Set())
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('manage.placeUnplacedTitle')}</DialogTitle>
        </DialogHeader>
        {boxName ? (
          <p className="text-sm text-muted-foreground">
            {t('manage.placeIntoBox', { name: boxName })}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {t('manage.remainingSlots', {
            count: maxSelectable < 0 ? 0 : maxSelectable,
          })}
        </p>

        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
          {unplacedQuery.isPending ? (
            <p className="p-2 text-sm text-muted-foreground">…</p>
          ) : items.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">
              {t('manage.unplacedEmpty')}
            </p>
          ) : maxSelectable <= 0 ? (
            <p className="p-2 text-sm text-muted-foreground">
              {t('manage.boxFull')}
            </p>
          ) : (
            items.map((item) => {
              const checked = selectedIds.has(item.id)
              const disabled =
                placeMutation.isPending ||
                (!checked && selectedIds.size >= maxSelectable)
              return (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(value) =>
                      toggle(item.id, value === true)
                    }
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {item.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.folderPath ?? '—'}
                    </span>
                  </span>
                </label>
              )
            })
          )}
        </div>

        {selectableCount > 0 && items.length > maxSelectable ? (
          <p className="text-xs text-muted-foreground">
            {t('manage.placeLimitHint', { remaining: maxSelectable })}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={placeMutation.isPending}
          >
            {t('form.actions.cancel')}
          </Button>
          <Button
            type="button"
            disabled={
              placeMutation.isPending ||
              selectedIds.size === 0 ||
              maxSelectable <= 0
            }
            onClick={() => placeMutation.mutate([...selectedIds])}
          >
            {t('manage.placeSelected', { count: selectedIds.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
