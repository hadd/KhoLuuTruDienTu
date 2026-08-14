import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { Row } from '@tanstack/react-table'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTableRowActions } from '@/components/common/data-table/data-table-row-actions'
import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { TextBlock } from '@/components/common/TextBlock'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DossierTypeDeleteDialog } from '@/features/dossier-type/components/DossierTypeDeleteDialog'
import { DossierTypeFormDialog } from '@/features/dossier-type/components/DossierTypeFormDialog'
import { useDossierTypeAccess } from '@/features/dossier-type/hooks/useDossierTypeAccess'
import {
  dossierTypesQueryOptions,
  useUpdateDossierType,
} from '@/features/dossier-type/queries'
import type { DossierTypeT } from '@/features/dossier-type/types'
import { GeneralCatalogListToolbar } from '@/features/general-catalog/components/GeneralCatalogListToolbar'
import { GeneralCatalogSectionTabs } from '@/features/general-catalog/components/GeneralCatalogSectionTabs'
import { GeneralCatalogSortableTableHead } from '@/features/general-catalog/components/GeneralCatalogSortableTableHead'
import { useCatalogTypeListSort } from '@/features/general-catalog/hooks/useCatalogTypeListSort'
import {
  DEFAULT_LIST_PAGE_LIMIT,
  LIST_PAGE_SIZE_OPTIONS,
} from '@/lib/schemas/list-page-search'

const routeApi = getRouteApi('/app/dossier-types/')

function toTableRow(dossierType: DossierTypeT): Row<DossierTypeT> {
  return { original: dossierType } as Row<DossierTypeT>
}

export function DossierTypeManagementPage() {
  const { t } = useTranslation('dossier-type')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const q = search.q ?? ''
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT
  const sortBy = search.sortBy
  const sortDir = search.sortDir

  const [inputValue, setInputValue] = useState(q)
  const [formOpen, setFormOpen] = useState(false)
  const [formReadOnly, setFormReadOnly] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedDossierType, setSelectedDossierType] =
    useState<DossierTypeT | null>(null)
  const {
    canCreateDossierTypes,
    canUpdateDossierTypes,
    canDeleteDossierTypes,
    canViewDossierTypes,
  } = useDossierTypeAccess()
  const updateDossierType = useUpdateDossierType()

  const { data, isPending, isFetching, isError } = useQuery(
    dossierTypesQueryOptions({ search: q, page, limit, sortBy, sortDir }),
  )
  const dossierTypes = data?.items ?? []
  const totalPages = Math.max(1, data?.totalPages ?? 1)
  const safePage = Math.min(Math.max(page, 1), totalPages)

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
    setSelectedDossierType(null)
    setFormReadOnly(false)
    setFormOpen(true)
  }

  const handleEdit = (dossierType: DossierTypeT) => {
    setSelectedDossierType(dossierType)
    setFormReadOnly(false)
    setFormOpen(true)
  }

  const handleView = (dossierType: DossierTypeT) => {
    setSelectedDossierType(dossierType)
    setFormReadOnly(true)
    setFormOpen(true)
  }

  const handleDelete = (dossierType: DossierTypeT) => {
    setSelectedDossierType(dossierType)
    setDeleteOpen(true)
  }

  const handleToggleActive = (dossierType: DossierTypeT) => {
    updateDossierType.mutate({
      id: dossierType.id,
      payload: { isActive: !dossierType.isActive },
    })
  }

  const showInitialLoading = isPending && dossierTypes.length === 0
  const { sortBy: activeSortBy, sortDir: activeSortDir, handleSortChange } =
    useCatalogTypeListSort(search, navigate)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <GeneralCatalogSectionTabs active="dossier-type" />
      <GeneralCatalogListToolbar
        searchValue={inputValue}
        onSearchChange={setInputValue}
        onSearch={submitSearch}
        searchPlaceholder={t('search.placeholder')}
        createLabel={t('actions.create')}
        onCreate={handleCreate}
        canCreate={canCreateDossierTypes}
      />

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
            <Table className="w-full table-fixed" containerClassName="overflow-x-hidden">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <GeneralCatalogSortableTableHead
                    className="w-[15%]"
                    label={t('table.columns.id')}
                    field="id"
                    sortBy={activeSortBy}
                    sortDir={activeSortDir}
                    onSortChange={handleSortChange}
                  />
                  <TableHead className="w-[22%]">
                    {t('table.columns.name')}
                  </TableHead>
                  <TableHead className="w-[40%] text-center">
                    {t('table.columns.description')}
                  </TableHead>
                  <GeneralCatalogSortableTableHead
                    className="w-[10%]"
                    label={t('table.columns.active')}
                    field="isActive"
                    sortBy={activeSortBy}
                    sortDir={activeSortDir}
                    onSortChange={handleSortChange}
                    align="center"
                  />
                  <TableHead className="w-24 text-right">
                    {t('table.columns.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dossierTypes.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {t('empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  dossierTypes.map((dossierType) => (
                    <TableRow
                      key={dossierType.id}
                      className={
                        !dossierType.isActive
                          ? 'opacity-50 grayscale transition-opacity'
                          : 'transition-opacity'
                      }
                    >
                      <TableCell className="align-top font-medium">
                        <TextBlock lines={1}>{dossierType.id}</TextBlock>
                      </TableCell>
                      <TableCell className="align-top">
                        <TextBlock lines={2}>{dossierType.name}</TextBlock>
                      </TableCell>
                      <TableCell className="align-top text-center">
                        <TextBlock lines={2}>
                          {dossierType.description}
                        </TextBlock>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex h-8 items-center justify-center">
                          <Switch
                            checked={dossierType.isActive === true}
                            onCheckedChange={() =>
                              handleToggleActive(dossierType)
                            }
                            disabled={
                              !canUpdateDossierTypes ||
                              updateDossierType.isPending
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <DataTableRowActions
                          row={toTableRow(dossierType)}
                          onView={
                            canViewDossierTypes && !canUpdateDossierTypes
                              ? handleView
                              : undefined
                          }
                          onEdit={
                            canUpdateDossierTypes ? handleEdit : undefined
                          }
                          onDelete={
                            canDeleteDossierTypes ? handleDelete : undefined
                          }
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

      <DossierTypeFormDialog
        open={formOpen}
        onOpenChange={(nextOpen) => {
          setFormOpen(nextOpen)
          if (!nextOpen) {
            setSelectedDossierType(null)
            setFormReadOnly(false)
          }
        }}
        dossierType={selectedDossierType}
        readOnly={formReadOnly}
      />

      <DossierTypeDeleteDialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          setDeleteOpen(nextOpen)
          if (!nextOpen) setSelectedDossierType(null)
        }}
        dossierType={selectedDossierType}
      />
    </div>
  )
}
