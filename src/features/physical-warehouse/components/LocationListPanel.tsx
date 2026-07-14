import { useQuery } from '@tanstack/react-query'
import { ImageIcon, MapPin, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ItemDeleteDialog } from '@/features/physical-warehouse/components/ItemDeleteDialog'
import type { ItemFormMode } from '@/features/physical-warehouse/components/ItemFormDialog'
import { ItemFormDialog } from '@/features/physical-warehouse/components/ItemFormDialog'
import { usePhysicalWarehouseAccess } from '@/features/physical-warehouse/hooks/usePhysicalWarehouseAccess'
import { physicalWarehouseItemsQueryOptions } from '@/features/physical-warehouse/queries'
import type { PhysicalWarehouseItemT } from '@/features/physical-warehouse/types'

export function LocationListPanel() {
  const { t } = useTranslation('physical-warehouse')
  const { canManageItems } = usePhysicalWarehouseAccess()
  const { data: locations = [], isPending } = useQuery(
    physicalWarehouseItemsQueryOptions(),
  )

  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selected, setSelected] = useState<PhysicalWarehouseItemT | null>(null)
  const [mode, setMode] = useState<ItemFormMode>({
    kind: 'location',
    isTopLevel: false,
    isBottomLevel: false,
    levelId: null,
    parentId: null,
    levelLabel: t('manage.locationLabel'),
  })

  function openCreate() {
    setSelected(null)
    setMode({
      kind: 'location',
      isTopLevel: false,
      isBottomLevel: false,
      levelId: null,
      parentId: null,
      levelLabel: t('manage.locationLabel'),
    })
    setFormOpen(true)
  }

  function openEdit(item: PhysicalWarehouseItemT) {
    setSelected(item)
    setMode({
      kind: 'location',
      isTopLevel: false,
      isBottomLevel: false,
      levelId: null,
      parentId: null,
      levelLabel: t('manage.locationLabel'),
    })
    setFormOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{t('locations.title')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('locations.description')}
          </p>
        </div>
        {canManageItems ? (
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="mr-1 size-4" />
            {t('locations.add')}
          </Button>
        ) : null}
      </div>

      {isPending ? (
        <p className="text-sm text-muted-foreground">...</p>
      ) : locations.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          {t('locations.empty')}
        </Card>
      ) : (
        <Card className="divide-y overflow-hidden">
          {locations.map((location) => {
            const imageSrc = location.imageDisplayUrl ?? location.imageUrl
            return (
              <div
                key={location.id}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40"
              >
                <div className="size-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt={location.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="size-5 opacity-50" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{location.name}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3 shrink-0" />
                    <span>{t('manage.locationLabel')}</span>
                  </div>
                </div>

                {canManageItems ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(location)}
                    >
                      {t('actions.edit')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={(location.childCount ?? 0) > 0}
                      title={
                        (location.childCount ?? 0) > 0
                          ? t('delete.hasChildren')
                          : t('actions.delete')
                      }
                      onClick={() => {
                        if ((location.childCount ?? 0) > 0) return
                        setSelected(location)
                        setDeleteOpen(true)
                      }}
                    >
                      {t('actions.delete')}
                    </Button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </Card>
      )}

      <ItemFormDialog
        key={`${selected?.id ?? 'new'}-${formOpen}`}
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={mode}
        item={selected}
      />
      <ItemDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        item={selected}
      />
    </div>
  )
}
