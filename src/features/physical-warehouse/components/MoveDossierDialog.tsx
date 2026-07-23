import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
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
import {
  getPhysicalWarehouseBottomBoxes,
  moveWarehouseDossierPlacement,
} from '@/features/physical-warehouse/api/physicalWarehouseClient'
import { cn } from '@/lib/utils/cn'
import { translateError } from '@/lib/utils/translate-error'

interface MoveDossierDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dossierId: string
  dossierName?: string
  currentPhysicalItemId: string
}

export function MoveDossierDialog({
  open,
  onOpenChange,
  dossierId,
  dossierName,
  currentPhysicalItemId,
}: MoveDossierDialogProps) {
  const { t } = useTranslation('physical-warehouse')
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null)

  const boxesQuery = useQuery({
    queryKey: ['physical-warehouse', 'bottom-boxes'],
    queryFn: () => getPhysicalWarehouseBottomBoxes(),
    enabled: open,
    staleTime: 10_000,
  })

  const boxes = useMemo(
    () =>
      (boxesQuery.data ?? []).filter(
        (box) => box.id !== currentPhysicalItemId,
      ),
    [boxesQuery.data, currentPhysicalItemId],
  )

  const filteredBoxes = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return boxes
    return boxes.filter(
      (box) =>
        box.name.toLowerCase().includes(query) ||
        box.breadcrumb.toLowerCase().includes(query),
    )
  }, [boxes, search])

  const selectedBox = boxes.find((box) => box.id === selectedBoxId) ?? null
  const selectedBoxFull =
    selectedBox?.remainingCapacity != null && selectedBox.remainingCapacity <= 0

  const moveMutation = useMutation({
    mutationFn: (physicalItemId: string) =>
      moveWarehouseDossierPlacement({ dossierId, physicalItemId }),
    onSuccess: () => {
      toast.success(t('manage.moveDossierSuccess'))
      void queryClient.invalidateQueries({
        queryKey: ['physical-warehouse'],
      })
      reset()
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(translateError(error) || String(error.message))
    },
  })

  function reset() {
    setSearch('')
    setSelectedBoxId(null)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('manage.moveDossierTitle')}</DialogTitle>
        </DialogHeader>
        {dossierName ? (
          <p className="text-sm text-muted-foreground">
            {t('manage.moveDossierDescription', { name: dossierName })}
          </p>
        ) : null}

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('manage.moveDossierSearchPlaceholder')}
        />

        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
          {boxesQuery.isPending ? (
            <p className="p-2 text-sm text-muted-foreground">…</p>
          ) : filteredBoxes.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">
              {t('manage.moveDossierEmpty')}
            </p>
          ) : (
            filteredBoxes.map((box) => {
              const isFull =
                box.remainingCapacity != null && box.remainingCapacity <= 0
              const isSelected = selectedBoxId === box.id
              return (
                <button
                  key={box.id}
                  type="button"
                  disabled={isFull}
                  onClick={() => setSelectedBoxId(box.id)}
                  className={cn(
                    'flex w-full flex-col items-start rounded-md px-3 py-2 text-left transition-colors',
                    isSelected ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted/60',
                    isFull && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <span className="text-sm font-medium">{box.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {box.breadcrumb}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {box.capacity != null
                      ? t('manage.usedCapacity', {
                          used: box.usedCapacity,
                          total: box.capacity,
                        })
                      : ''}
                    {isFull ? ` · ${t('manage.boxFull')}` : ''}
                  </span>
                </button>
              )
            })
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={moveMutation.isPending}
          >
            {t('form.actions.cancel')}
          </Button>
          <Button
            type="button"
            disabled={
              moveMutation.isPending || !selectedBoxId || selectedBoxFull
            }
            onClick={() => {
              if (selectedBoxId) moveMutation.mutate(selectedBoxId)
            }}
          >
            {t('manage.moveDossierConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
