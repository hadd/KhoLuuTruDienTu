import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ItemDeleteDialog } from '@/features/physical-warehouse/components/ItemDeleteDialog'
import type {ItemFormMode} from '@/features/physical-warehouse/components/ItemFormDialog';
import {
  ItemFormDialog
} from '@/features/physical-warehouse/components/ItemFormDialog'
import { usePhysicalWarehouseAccess } from '@/features/physical-warehouse/hooks/usePhysicalWarehouseAccess'
import { physicalWarehouseItemsQueryOptions } from '@/features/physical-warehouse/queries'
import type { PhysicalWarehouseItemT } from '@/features/physical-warehouse/types'

interface LocationListPanelProps {
  selectedRootId?: string
  onSelect: (id: string) => void
}

export function LocationListPanel({
  selectedRootId,
  onSelect,
}: LocationListPanelProps) {
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
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">{t('locations.title')}</h2>
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => {
            const isSelected = location.id === selectedRootId
            return (
              <Card
                key={location.id}
                className={`space-y-3 p-4 ${isSelected ? 'border-primary' : ''}`}
              >
                {location.imageUrl ? (
                  <img
                    src={location.imageUrl}
                    alt={location.name}
                    className="h-28 w-full rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-28 items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
                    {location.name}
                  </div>
                )}
                <div className="font-medium">{location.name}</div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? 'default' : 'outline'}
                    onClick={() => onSelect(location.id)}
                  >
                    {isSelected
                      ? t('locations.selected')
                      : t('locations.select')}
                  </Button>
                  {canManageItems ? (
                    <>
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
                        onClick={() => {
                          setSelected(location)
                          setDeleteOpen(true)
                        }}
                      >
                        {t('actions.delete')}
                      </Button>
                    </>
                  ) : null}
                </div>
              </Card>
            )
          })}
        </div>
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
