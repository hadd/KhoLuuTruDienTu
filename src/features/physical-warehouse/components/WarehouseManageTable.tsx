import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { usePhysicalWarehouseAccess } from '@/features/physical-warehouse/hooks/usePhysicalWarehouseAccess'
import { physicalWarehouseItemsQueryOptions } from '@/features/physical-warehouse/queries'
import type { PhysicalWarehouseItemT } from '@/features/physical-warehouse/types'

interface WarehouseManageTableProps {
  locationId: string
  locationName?: string
  onBack: () => void
  backLabelKey?: 'locations.backToBrowse' | 'locations.backToLocationManage'
}

export function WarehouseManageTable({
  locationId,
  locationName,
  onBack,
  backLabelKey = 'locations.backToBrowse',
}: WarehouseManageTableProps) {
  const { t } = useTranslation('physical-warehouse')
  const { canManageWarehouses } = usePhysicalWarehouseAccess()
  const { data: warehouses = [], isPending } = useQuery(
    physicalWarehouseItemsQueryOptions(locationId),
  )

  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selected, setSelected] = useState<PhysicalWarehouseItemT | null>(null)
  const [mode, setMode] = useState<ItemFormMode>({
    kind: 'warehouse',
    parentId: locationId,
    levelLabel: t('manage.warehouseLabel'),
  })

  function openCreate() {
    setSelected(null)
    setMode({
      kind: 'warehouse',
      parentId: locationId,
      levelLabel: t('manage.warehouseLabel'),
    })
    setFormOpen(true)
  }

  function openEdit(item: PhysicalWarehouseItemT) {
    setSelected(item)
    setMode({
      kind: 'warehouse',
      parentId: locationId,
      levelLabel: t('manage.warehouseLabel'),
    })
    setFormOpen(true)
  }

  function openDelete(item: PhysicalWarehouseItemT) {
    setSelected(item)
    setDeleteOpen(true)
  }

  const title = locationName
    ? t('locations.insideLocation', { name: locationName })
    : t('locations.manageWarehousesTitle')

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
            {t(backLabelKey)}
          </Button>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {t('locations.manageWarehousesDescription')}
          </p>
        </div>
        {canManageWarehouses ? (
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="mr-1 size-4" />
            {t('locations.addWarehouse')}
          </Button>
        ) : null}
      </div>

      <Card className="overflow-hidden" variant="list">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('manage.columns.name')}</TableHead>
              <TableHead>{t('manage.columns.address')}</TableHead>
              {canManageWarehouses ? (
                <TableHead className="w-[100px]">
                  {t('manage.columns.actions')}
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={canManageWarehouses ? 3 : 2}>...</TableCell>
              </TableRow>
            ) : warehouses.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManageWarehouses ? 3 : 2}
                  className="text-muted-foreground"
                >
                  {t('manage.empty')}
                </TableCell>
              </TableRow>
            ) : (
              warehouses.map((warehouse) => {
                const childCount = warehouse.childCount ?? 0
                const canDelete = childCount === 0

                return (
                  <TableRow key={warehouse.id}>
                    <TableCell className="font-medium">{warehouse.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span>{warehouse.address ?? '—'}</span>
                        {warehouse.mapsUrl ? (
                          <a
                            href={warehouse.mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={t('manage.viewOnMap')}
                            aria-label={t('manage.viewOnMap')}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <MapPin className="size-4" />
                          </a>
                        ) : null}
                      </div>
                    </TableCell>
                    {canManageWarehouses ? (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label={t('actions.edit')}
                            onClick={() => openEdit(warehouse)}
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
                              openDelete(warehouse)
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {canManageWarehouses ? (
        <>
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
        </>
      ) : null}
    </div>
  )
}
