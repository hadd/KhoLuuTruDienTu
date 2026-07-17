import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { Row } from '@tanstack/react-table'
import { Loader2, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DataTableRowActions } from '@/components/common/data-table/data-table-row-actions'
import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
import { TextBlock } from '@/components/common/TextBlock'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { GeneralCatalogBackNav } from '@/features/general-catalog/components/GeneralCatalogBackNav'
import { GeneralCatalogSectionTabs } from '@/features/general-catalog/components/GeneralCatalogSectionTabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RetentionPeriodDeleteDialog } from '@/features/retention-period/components/RetentionPeriodDeleteDialog'
import { RetentionPeriodFormDialog } from '@/features/retention-period/components/RetentionPeriodFormDialog'
import { useRetentionPeriodAccess } from '@/features/retention-period/hooks/useRetentionPeriodAccess'
import { formatRetentionDurationLabel } from '@/features/retention-period/lib/formatRetentionDuration'
import {
  retentionPeriodsQueryOptions,
  useUpdateRetentionPeriod,
} from '@/features/retention-period/queries'
import type { RetentionPeriodT } from '@/features/retention-period/types'
import { translateError } from '@/lib/utils/translate-error'
import {
  DEFAULT_LIST_PAGE_LIMIT,
  LIST_PAGE_SIZE_OPTIONS,
} from '@/lib/schemas/list-page-search'

const routeApi = getRouteApi('/app/retention-periods/')

function toTableRow(period: RetentionPeriodT): Row<RetentionPeriodT> {
  return { original: period } as Row<RetentionPeriodT>
}

export function RetentionPeriodManagementPage() {
  const { t } = useTranslation('retention-period')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const q = search.q ?? ''
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT

  const [inputValue, setInputValue] = useState(q)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<RetentionPeriodT | null>(
    null,
  )
  const {
    canCreateRetentionPeriods,
    canUpdateRetentionPeriods,
    canDeleteRetentionPeriods,
  } = useRetentionPeriodAccess()
  const updatePeriod = useUpdateRetentionPeriod()

  const { data, isPending, isFetching, isError } = useQuery(
    retentionPeriodsQueryOptions({ search: q, page, limit }),
  )
  const periods = data?.items ?? []
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
    setSelectedPeriod(null)
    setFormOpen(true)
  }

  const handleEdit = (period: RetentionPeriodT) => {
    setSelectedPeriod(period)
    setFormOpen(true)
  }

  const handleDelete = (period: RetentionPeriodT) => {
    setSelectedPeriod(period)
    setDeleteOpen(true)
  }

  const handleToggleActive = (period: RetentionPeriodT) => {
    updatePeriod.mutate(
      {
        id: period.id,
        payload: { isActive: !period.isActive },
      },
      {
        onError: (error) => {
          toast.error(translateError(error))
        },
      },
    )
  }

  const showInitialLoading = isPending && periods.length === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <GeneralCatalogSectionTabs active="retention" />
      <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <GeneralCatalogBackNav
          currentLabel={t('title')}
          description={t('description')}
        />
        <Button
          type="button"
          onClick={handleCreate}
          disabled={!canCreateRetentionPeriods}
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
            <Table className="w-full min-w-[480px] table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>
                    {t('table.columns.duration')}
                  </TableHead>
                  <TableHead className="w-28 text-center">
                    {t('table.columns.active')}
                  </TableHead>
                  <TableHead className="w-24 text-right">
                    {t('table.columns.actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {t('empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  periods.map((period) => (
                    <TableRow
                      key={period.id}
                      className={
                        !period.isActive
                          ? 'opacity-50 grayscale transition-opacity'
                          : 'transition-opacity'
                      }
                    >
                      <TableCell className="align-top font-medium">
                        <TextBlock lines={2}>
                          {formatRetentionDurationLabel(period, t)}
                        </TextBlock>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex h-8 items-center justify-center">
                          <Switch
                            checked={period.isActive === true}
                            onCheckedChange={() => handleToggleActive(period)}
                            disabled={
                              !canUpdateRetentionPeriods ||
                              updatePeriod.isPending
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <DataTableRowActions
                          row={toTableRow(period)}
                          onEdit={
                            canUpdateRetentionPeriods && !period.isPermanent
                              ? handleEdit
                              : undefined
                          }
                          onDelete={
                            canDeleteRetentionPeriods && !period.isPermanent
                              ? handleDelete
                              : undefined
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

      <RetentionPeriodFormDialog
        open={formOpen}
        onOpenChange={(nextOpen) => {
          setFormOpen(nextOpen)
          if (!nextOpen) setSelectedPeriod(null)
        }}
        period={selectedPeriod}
      />

      <RetentionPeriodDeleteDialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          setDeleteOpen(nextOpen)
          if (!nextOpen) setSelectedPeriod(null)
        }}
        period={selectedPeriod}
      />
    </div>
  )
}
