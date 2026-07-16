import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { Row } from '@tanstack/react-table'
import { Loader2, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTableRowActions } from '@/components/common/data-table/data-table-row-actions'
import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
import { TextBlock } from '@/components/common/TextBlock'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { GeneralCatalogBackNav } from '@/features/general-catalog/components/GeneralCatalogBackNav'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { archiveFondsQueryOptions } from '@/features/archive-fond/queries'
import { InventoryDeleteDialog } from '@/features/inventory/components/InventoryDeleteDialog'
import { InventoryFormDialog } from '@/features/inventory/components/InventoryFormDialog'
import { useInventoryAccess } from '@/features/inventory/hooks/useInventoryAccess'
import {
  inventoriesQueryOptions,
  useUpdateInventory,
} from '@/features/inventory/queries'
import type { InventoryT } from '@/features/inventory/types'
import {
  DEFAULT_LIST_PAGE_LIMIT,
  LIST_PAGE_SIZE_OPTIONS,
} from '@/lib/schemas/list-page-search'

const routeApi = getRouteApi('/app/inventories/')

function toTableRow(inventory: InventoryT): Row<InventoryT> {
  return { original: inventory } as Row<InventoryT>
}

export function InventoryManagementPage() {
  const { t } = useTranslation('inventory')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const q = search.q ?? ''
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT

  const [inputValue, setInputValue] = useState(q)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedInventory, setSelectedInventory] = useState<InventoryT | null>(
    null,
  )
  const {
    canCreateInventories,
    canUpdateInventories,
    canDeleteInventories,
  } = useInventoryAccess()
  const updateInventory = useUpdateInventory()

  const { data, isPending, isFetching, isError } = useQuery(
    inventoriesQueryOptions({ search: q, page, limit }),
  )
  const inventories = data?.items ?? []
  const totalPages = Math.max(1, data?.totalPages ?? 1)
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const { data: fondsData } = useQuery(
    archiveFondsQueryOptions({ page: 1, limit: 100 }),
  )
  const fonds = fondsData?.items ?? []

  const fondNameById = useMemo(
    () => new Map(fonds.map((fond) => [fond.id, fond.fondName])),
    [fonds],
  )

  useEffect(() => {
    setInputValue(q)
  }, [q])

  function submitSearch() {
    void navigate({
      search: (prev) => ({
        ...prev,
        q: inputValue.trim() ? inputValue.trim() : undefined,
        page: 1,
      }),
      replace: true,
    })
  }

  useEffect(() => {
    if (isPending || isFetching || !data) return
    if (safePage !== page) {
      void navigate({
        search: (prev) => ({ ...prev, page: safePage }),
        replace: true,
      })
    }
  }, [safePage, page, navigate, isPending, isFetching, data])

  const handleCreate = () => {
    setSelectedInventory(null)
    setFormOpen(true)
  }

  const handleEdit = (inventory: InventoryT) => {
    setSelectedInventory(inventory)
    setFormOpen(true)
  }

  const handleDelete = (inventory: InventoryT) => {
    setSelectedInventory(inventory)
    setDeleteOpen(true)
  }

  const handleToggleActive = (inventory: InventoryT) => {
    updateInventory.mutate({
      id: inventory.id,
      payload: { isActive: !inventory.isActive },
    })
  }

  const showInitialLoading = isPending && inventories.length === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <GeneralCatalogBackNav
          currentLabel={t('title')}
          description={t('description')}
        />
        <Button
          type="button"
          onClick={handleCreate}
          disabled={!canCreateInventories}
        >
          <Plus className="size-4" />
          {t('actions.create')}
        </Button>
      </div>

      <div className="shrink-0">
        <ListPageSearchInput
          value={inputValue}
          onChange={setInputValue}
          onSearch={submitSearch}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
        />
      </div>

      {isError && (
        <div className="flex shrink-0 flex-col items-center justify-center gap-3 rounded-md border border-border bg-muted/30 p-8">
          <p className="text-sm text-muted-foreground">{t('errors.loadFailed')}</p>
        </div>
      )}

      <Card
        variant="list"
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {isFetching && !showInitialLoading && (
          <div className="absolute inset-x-0 top-0 z-10 flex justify-center bg-background/60 py-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {showInitialLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table className="w-full min-w-[1080px] table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[10%]">{t('table.columns.id')}</TableHead>
                  <TableHead className="w-[10%]">{t('table.columns.number')}</TableHead>
                  <TableHead className="w-[20%]">{t('table.columns.name')}</TableHead>
                  <TableHead className="w-[16%]">{t('table.columns.fond')}</TableHead>
                  <TableHead className="w-[10%]">{t('table.columns.submissionYear')}</TableHead>
                  <TableHead className="w-[16%]">{t('table.columns.submittingUnit')}</TableHead>
                  <TableHead className="w-[8%] text-center">{t('table.columns.active')}</TableHead>
                  <TableHead className="w-24 text-right">{t('table.columns.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      {t('empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  inventories.map((inventory) => (
                    <TableRow
                      key={inventory.id}
                      className={!inventory.isActive ? 'opacity-50 grayscale transition-opacity' : 'transition-opacity'}
                    >
                      <TableCell className="align-top font-medium">
                        <TextBlock lines={1}>{inventory.id}</TextBlock>
                      </TableCell>
                      <TableCell className="align-top">
                        <TextBlock lines={1}>{inventory.number}</TextBlock>
                      </TableCell>
                      <TableCell className="align-top">
                        <TextBlock lines={2}>{inventory.name}</TextBlock>
                      </TableCell>
                      <TableCell className="align-top">
                        <TextBlock lines={2}>
                          {fondNameById.get(inventory.fondId) ?? inventory.fondId}
                        </TextBlock>
                      </TableCell>
                      <TableCell className="align-top tabular-nums">
                        {inventory.submissionYear}
                      </TableCell>
                      <TableCell className="align-top">
                        <TextBlock lines={2}>{inventory.submittingUnit}</TextBlock>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex h-8 items-center justify-center">
                          <Switch
                            checked={inventory.isActive === true}
                            onCheckedChange={() => handleToggleActive(inventory)}
                            disabled={!canUpdateInventories || updateInventory.isPending}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <DataTableRowActions
                          row={toTableRow(inventory)}
                          onEdit={canUpdateInventories ? handleEdit : undefined}
                          onDelete={canDeleteInventories ? handleDelete : undefined}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      <ListPagePagination
        page={safePage}
        totalPages={totalPages}
        limit={limit}
        pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
        onPageChange={(nextPage) => {
          void navigate({
            search: (prev) => ({ ...prev, page: nextPage }),
            replace: true,
          })
        }}
        onLimitChange={(nextLimit) => {
          void navigate({
            search: (prev) => ({ ...prev, limit: nextLimit, page: 1 }),
            replace: true,
          })
        }}
      />

      <InventoryFormDialog
        open={formOpen}
        onOpenChange={(nextOpen) => {
          setFormOpen(nextOpen)
          if (!nextOpen) setSelectedInventory(null)
        }}
        inventory={selectedInventory}
      />

      <InventoryDeleteDialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          setDeleteOpen(nextOpen)
          if (!nextOpen) setSelectedInventory(null)
        }}
        inventory={selectedInventory}
      />
    </div>
  )
}
