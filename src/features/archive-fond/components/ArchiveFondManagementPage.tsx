import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { Row } from '@tanstack/react-table'
import { Edit, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { TextBlock } from '@/components/common/TextBlock'
import { Button } from '@/components/ui/button'
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
import { ArchiveFondDeleteDialog } from '@/features/archive-fond/components/ArchiveFondDeleteDialog'
import { ArchiveFondFormDialog } from '@/features/archive-fond/components/ArchiveFondFormDialog'
import { useFondAccess } from '@/features/archive-fond/hooks/useFondAccess'
import { archiveFondsQueryOptions, useUpdateArchiveFond } from '@/features/archive-fond/queries'
import type { ArchiveFondT } from '@/features/archive-fond/types'
import { GeneralCatalogListToolbar } from '@/features/general-catalog/components/GeneralCatalogListToolbar'
import { GeneralCatalogSectionTabs } from '@/features/general-catalog/components/GeneralCatalogSectionTabs'
import {
  DEFAULT_LIST_PAGE_LIMIT,
  LIST_PAGE_SIZE_OPTIONS,
} from '@/lib/schemas/list-page-search'
import { formatNumber } from '@/lib/utils/format'

const routeApi = getRouteApi('/app/archive-fonds/')

function toTableRow(fond: ArchiveFondT): Row<ArchiveFondT> {
  return { original: fond } as Row<ArchiveFondT>
}

export function ArchiveFondManagementPage() {
  const { t } = useTranslation('archive-fond')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const q = search.q ?? ''
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT

  const [inputValue, setInputValue] = useState(q)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedFond, setSelectedFond] = useState<ArchiveFondT | null>(null)
  
  const updateFondMutation = useUpdateArchiveFond()

  const {
    canCreateFonds,
    canUpdateFonds,
    canDeleteFonds,
  } = useFondAccess()

  const { data, isPending, isFetching, isError } = useQuery(
    archiveFondsQueryOptions({ search: q, page, limit }),
  )
  const fonds = data?.items ?? []
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
    setSelectedFond(null)
    setFormOpen(true)
  }

  const handleEdit = (fond: ArchiveFondT) => {
    setSelectedFond(fond)
    setFormOpen(true)
  }

  const handleDelete = (fond: ArchiveFondT) => {
    setSelectedFond(fond)
    setDeleteOpen(true)
  }

  const handleToggleActive = (fond: ArchiveFondT) => {
    updateFondMutation.mutate({
      id: fond.id,
      payload: { isActive: !fond.isActive },
    })
  }

  const handleToggleZipPassword = (fond: ArchiveFondT) => {
    if (!fond.hasZipPassword) return
    updateFondMutation.mutate({
      id: fond.id,
      payload: { zipPasswordEnabled: !fond.zipPasswordEnabled },
    })
  }

  const showInitialLoading = isPending && fonds.length === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <GeneralCatalogSectionTabs active="fonds" />
      <GeneralCatalogListToolbar
        searchValue={inputValue}
        onSearchChange={setInputValue}
        onSearch={submitSearch}
        searchPlaceholder={t('search.placeholder')}
        createLabel={t('actions.create')}
        onCreate={handleCreate}
        canCreate={canCreateFonds}
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
          <Table className="w-full min-w-[1080px] table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[8%]">
                  {t('table.columns.id')}
                </TableHead>
                <TableHead className="w-[15%]">
                  {t('table.columns.fondName')}
                </TableHead>
                <TableHead className="w-[18%]">
                  {t('table.columns.archiveAgency')}
                </TableHead>
                <TableHead className="w-[15%]">
                  {t('table.columns.adminstrativeHistory')}
                </TableHead>
                <TableHead className="w-[12%]">
                  {t('table.columns.fondType')}
                </TableHead>
                <TableHead className="w-[9%] text-left">
                  {t('table.columns.dossierCount')}
                </TableHead>
                <TableHead className="w-[10%] text-center">
                  {t('table.columns.zipPassword')}
                </TableHead>
                <TableHead className="w-[10%] text-center">
                  {t('table.columns.active')}
                </TableHead>
                <TableHead className="w-16 text-center">
                  {t('table.columns.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fonds.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {t('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                fonds.map((fond) => (
                  <TableRow 
                    key={fond.id}
                    className={!fond.isActive ? 'opacity-50 grayscale transition-opacity' : 'transition-opacity'}
                  >
                    <TableCell className="align-top font-medium">
                      <div className="break-words">{fond.id}</div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="break-words whitespace-pre-wrap">{fond.fondName}</div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="break-words whitespace-pre-wrap">{fond.archiveAgency}</div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="break-words whitespace-pre-wrap">
                        {fond.adminstrativeHistory}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="break-words whitespace-pre-wrap">{fond.fondType}</div>
                    </TableCell>
                    <TableCell className="align-top text-center pr-[3%] tabular-nums">
                      {formatNumber(fond.dossierCount)}
                    </TableCell>
                    <TableCell className="align-top">
                      <div
                        className="flex h-8 items-center justify-center"
                        title={
                          !canUpdateFonds
                            ? t('actions.noUpdatePermission')
                            : !fond.hasZipPassword
                              ? t('actions.zipPasswordNeedsPassword')
                              : fond.zipPasswordEnabled
                                ? t('actions.zipPasswordDisable')
                                : t('actions.zipPasswordEnable')
                        }
                      >
                        <Switch
                          checked={
                            fond.zipPasswordEnabled === true &&
                            fond.hasZipPassword === true
                          }
                          onCheckedChange={() => handleToggleZipPassword(fond)}
                          disabled={
                            !canUpdateFonds ||
                            !fond.hasZipPassword ||
                            updateFondMutation.isPending
                          }
                        />
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div
                        className="flex h-8 items-center justify-center"
                        title={
                          !canUpdateFonds
                            ? t('actions.noUpdatePermission')
                            : fond.isActive
                              ? t('actions.deactivate')
                              : t('actions.activate')
                        }
                      >
                        <Switch
                          checked={fond.isActive === true}
                          onCheckedChange={() => handleToggleActive(fond)}
                          disabled={!canUpdateFonds || updateFondMutation.isPending}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex justify-center gap-1">
                        {canUpdateFonds ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(fond)}
                            title={t('actions.edit')}
                          >
                            <Edit className="h-4 w-4 text-blue-600" />
                          </Button>
                        ) : null}
                        {canDeleteFonds ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDelete(fond)}
                            disabled={fond.dossierCount > 0}
                            title={
                              fond.dossierCount > 0
                                ? t('delete.blockedHasDossiers', {
                                    count: fond.dossierCount,
                                  })
                                : t('actions.delete')
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
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

      <ArchiveFondFormDialog
        open={formOpen}
        onOpenChange={(nextOpen) => {
          setFormOpen(nextOpen)
          if (!nextOpen) setSelectedFond(null)
        }}
        fond={selectedFond}
      />

      <ArchiveFondDeleteDialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          setDeleteOpen(nextOpen)
          if (!nextOpen) setSelectedFond(null)
        }}
        fond={selectedFond}
      />
    </div>
  )
}
