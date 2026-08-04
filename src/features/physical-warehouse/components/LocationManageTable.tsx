import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, List, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ItemDeleteDialog } from '@/features/physical-warehouse/components/ItemDeleteDialog'
import type { ItemFormMode } from '@/features/physical-warehouse/components/ItemFormDialog'
import { ItemFormDialog } from '@/features/physical-warehouse/components/ItemFormDialog'
import { WarehouseManageTable } from '@/features/physical-warehouse/components/WarehouseManageTable'
import { usePhysicalWarehouseAccess } from '@/features/physical-warehouse/hooks/usePhysicalWarehouseAccess'
import { physicalWarehouseItemsQueryOptions } from '@/features/physical-warehouse/queries'
import type { PhysicalWarehouseItemT } from '@/features/physical-warehouse/types'

interface LocationManageTableProps {
  onBack: () => void
}

export function LocationManageTable({ onBack }: LocationManageTableProps) {
  const { t } = useTranslation('physical-warehouse')
  const { canManageLocations } = usePhysicalWarehouseAccess()
  const { data: locations = [], isPending } = useQuery(
    physicalWarehouseItemsQueryOptions(),
  )

  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selected, setSelected] = useState<PhysicalWarehouseItemT | null>(null)
  const [viewingWarehousesFor, setViewingWarehousesFor] =
    useState<PhysicalWarehouseItemT | null>(null)
  const [mode, setMode] = useState<ItemFormMode>({
    kind: 'location',
    parentId: null,
    levelLabel: t('manage.locationLabel'),
    isBottomLevel: false,
  })

  if (!canManageLocations) {
    return null
  }

  if (viewingWarehousesFor) {
    return (
      <WarehouseManageTable
        locationId={viewingWarehousesFor.id}
        locationName={viewingWarehousesFor.name}
        backLabelKey="locations.backToLocationManage"
        onBack={() => setViewingWarehousesFor(null)}
      />
    )
  }

  function openCreate() {
    setSelected(null)
    setMode({
      kind: 'location',
      parentId: null,
      levelLabel: t('manage.locationLabel'),
      isBottomLevel: false,
    })
    setFormOpen(true)
  }

  function openEdit(item: PhysicalWarehouseItemT) {
    setSelected(item)
    setMode({
      kind: 'location',
      parentId: null,
      levelLabel: t('manage.locationLabel'),
      isBottomLevel: false,
    })
    setFormOpen(true)
  }

  function openDelete(item: PhysicalWarehouseItemT) {
    setSelected(item)
    setDeleteOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 px-2 text-muted-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="mr-1 size-4" />
            {t('locations.backToBrowse')}
          </Button>
          <h2 className="text-base font-semibold">{t('locations.manageTitle')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('locations.manageDescription')}
          </p>
        </div>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="mr-1 size-4" />
          {t('locations.add')}
        </Button>
      </div>

      <Card className="overflow-hidden" variant="list">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('manage.columns.name')}</TableHead>
              <TableHead>{t('manage.columns.address')}</TableHead>
              <TableHead>{t('locations.warehouseCountColumn')}</TableHead>
              <TableHead className="w-[120px]">
                {t('manage.columns.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={4}>...</TableCell>
              </TableRow>
            ) : locations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  {t('locations.empty')}
                </TableCell>
              </TableRow>
            ) : (
              locations.map((location) => {
                const childCount = location.childCount ?? 0
                const canDelete = childCount === 0

                return (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">{location.name}</TableCell>
                    <TableCell>{location.address ?? '—'}</TableCell>
                    <TableCell>
                      {t('locations.warehouseCount', { count: childCount })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          title={t('locations.viewWarehouses')}
                          aria-label={t('locations.viewWarehouses')}
                          onClick={() => setViewingWarehousesFor(location)}
                        >
                          <List className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          aria-label={t('actions.edit')}
                          onClick={() => openEdit(location)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8 text-destructive hover:text-destructive"
                          disabled={!canDelete}
                          title={
                            canDelete
                              ? t('actions.delete')
                              : t('delete.hasChildren')
                          }
                          aria-label={t('actions.delete')}
                          onClick={() => {
                            if (!canDelete) return
                            openDelete(location)
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

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