import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArchiveWarehouseDataShell } from '@/features/archive-warehouse/components/ArchiveWarehouseDataShell'
import { ArchiveWarehouseDrillDownHeader } from '@/features/archive-warehouse/components/ArchiveWarehouseDrillDownHeader'
import { ArchiveWarehouseStatCards } from '@/features/archive-warehouse/components/ArchiveWarehouseStatCards'
import { buildArchiveDossierDetailSearch } from '@/features/archive-warehouse/lib/archiveDossierDetailNavigation'
import {
  buildDossiersBrowseBreadcrumbSegments,
  buildListBreadcrumbSegments,
} from '@/features/archive-warehouse/lib/archiveWarehouseBreadcrumb'
import { BROWSE_VIEW_LABEL_KEYS } from '@/features/archive-warehouse/schemas'
import { UNASSIGNED_WAREHOUSE_FOND_ID } from '@/features/archive-warehouse/lib/unassignedFond'
import {
  archiveWarehouseDocumentTypeSummaryQueryOptions,
  archiveWarehouseDocumentTypesQueryOptions,
  archiveWarehouseDocumentsByTypeQueryOptions,
} from '@/features/archive-warehouse/queries'
import type { ArchiveWarehouseDocumentsByTypeSearchT } from '@/features/archive-warehouse/schemas'
import { DEFAULT_LIST_PAGE_LIMIT, LIST_PAGE_SIZE_OPTIONS } from '@/lib/schemas/list-page-search'
import { formatDate } from '@/lib/utils/date'
import { formatFileSize } from '@/lib/utils/format'
import { translateError } from '@/lib/utils/translate-error'

const routeApi = getRouteApi('/app/archive-dossiers/by-document-type/$documentTypeId/')

export function ArchiveWarehouseDocumentsByTypePage() {
  const { t, i18n } = useTranslation('archive-warehouse')
  const { documentTypeId } = routeApi.useParams()
  const search = routeApi.useSearch() as unknown as ArchiveWarehouseDocumentsByTypeSearchT
  const navigate = routeApi.useNavigate()
  const dateLocale = i18n.language.startsWith('vi') ? 'vi' : 'en'

  const q = search.q ?? ''
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT

  const [inputValue, setInputValue] = useState(q)

  const { data: documentTypesData } = useQuery(archiveWarehouseDocumentTypesQueryOptions())
  const documentTypeName =
    documentTypesData?.items.find((item) => item.id === documentTypeId)?.name ??
    documentTypeId

  const summaryParams = { documentTypeId }
  const listParams = {
    documentTypeId,
    page,
    limit,
    search: q || undefined,
  }

  const {
    data: summaryData,
    isError: isSummaryError,
    error: summaryError,
  } = useQuery(archiveWarehouseDocumentTypeSummaryQueryOptions(summaryParams))

  const {
    data,
    isPending,
    isFetching,
    isError: isListError,
    error: listError,
  } = useQuery(archiveWarehouseDocumentsByTypeQueryOptions(listParams))

  const items = data?.items ?? []
  const totalPages = Math.max(1, data?.totalPages ?? 1)
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const listLoading = isPending || isFetching
  const hasActiveFilters = Boolean(q)

  useEffect(() => {
    setInputValue(q)
  }, [q])

  useEffect(() => {
    if (listLoading || !data) return
    if (safePage !== page) {
      void navigate({
        search: (prev) => ({ ...prev, page: safePage }),
        replace: true,
      })
    }
  }, [safePage, page, navigate, listLoading, data])

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

  function navigateToHubRoot() {
    void navigate({
      to: '/app/archive-warehouse',
      search: { page: 1 },
    })
  }

  function navigateToDossiersBrowsePicker() {
    void navigate({
      to: '/app/archive-warehouse',
      search: {
        tab: 'dossiers',
        page: 1,
      },
    })
  }

  function navigateBackToBrowseList() {
    void navigate({
      to: '/app/archive-warehouse',
      search: { tab: 'dossiers', browseView: 'documentTypes', page: 1 },
    })
  }

  function openDocumentDetail(
    dossierId: string,
    fondId: string | null,
    fileId: string,
  ) {
    void navigate({
      to: '/app/archive-dossiers/$fondId/$dossierId',
      params: {
        fondId: fondId ?? UNASSIGNED_WAREHOUSE_FOND_ID,
        dossierId,
      },
      search: buildArchiveDossierDetailSearch(
        {
          browseView: 'documentTypes',
          documentTypeId,
        },
        {
          fileId,
          singleFile: true,
        },
      ),
    })
  }

  const forbiddenMessage =
    isSummaryError || isListError
      ? translateError(
          (summaryError ?? listError) instanceof Error
            ? (summaryError ?? listError)
            : new Error(t('errors.loadFailed')),
        )
      : null

  return (
    <ArchiveWarehouseDataShell>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto">
        <div className="shrink-0 space-y-3">
          <ArchiveWarehouseDrillDownHeader
            segments={buildDossiersBrowseBreadcrumbSegments({
              hubRootLabel: t('breadcrumb.root'),
              dossiersTabLabel: t('tabs.dossiers'),
              browseViewLabel: t(BROWSE_VIEW_LABEL_KEYS.documentTypes),
              segments: buildListBreadcrumbSegments(
                t('page.documentTypeDocumentsTitle', { name: documentTypeName }),
              ),
              onNavigateHub: navigateToHubRoot,
              onNavigateDossiersTab: navigateToDossiersBrowsePicker,
              onNavigateBrowseView: navigateBackToBrowseList,
            })}
            onBack={navigateBackToBrowseList}
            backAriaLabel={t('page.backToFonds')}
          />
          {!forbiddenMessage && summaryData ? (
            <ArchiveWarehouseStatCards summary={summaryData} />
          ) : null}

          {forbiddenMessage ? (
            <Card className="border-destructive p-8 text-center text-sm text-destructive">
              {forbiddenMessage}
            </Card>
          ) : null}

          {!forbiddenMessage ? (
            <ListPageSearchInput
              value={inputValue}
              onChange={setInputValue}
              onSearch={submitSearch}
              placeholder={t('page.documentSearchPlaceholder')}
              className="max-w-md"
            />
          ) : null}
        </div>

        {!forbiddenMessage ? (
          <div className="flex flex-col gap-3">
            {listLoading && items.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-16">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : null}

            {!listLoading && summaryData?.documentCount === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">
                {t('page.documentTypeEmpty')}
              </Card>
            ) : null}

            {!listLoading &&
            summaryData &&
            summaryData.documentCount > 0 &&
            items.length === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">
                {hasActiveFilters ? t('page.noMatch') : t('page.documentTypeEmpty')}
              </Card>
            ) : null}

            {!listLoading && items.length > 0 ? (
              <div className="overflow-hidden rounded-lg border">
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('table.fileName')}</TableHead>
                      <TableHead>{t('table.dossierName')}</TableHead>
                      <TableHead>{t('table.fond')}</TableHead>
                      <TableHead>{t('table.fileSize')}</TableHead>
                      <TableHead>{t('table.createdAt')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer"
                        onClick={() =>
                          openDocumentDetail(item.dossierId, item.fondId, item.id)
                        }
                      >
                        <TableCell className="truncate font-medium">{item.fileName}</TableCell>
                        <TableCell className="truncate">{item.dossierName}</TableCell>
                        <TableCell className="truncate">{item.fondName ?? '—'}</TableCell>
                        <TableCell>
                          {item.fileSizeKb != null
                            ? formatFileSize(item.fileSizeKb * 1024)
                            : '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDate(item.createdAt, 'P', dateLocale)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            {items.length > 0 ? (
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
            ) : null}
          </div>
        ) : null}
      </div>
    </ArchiveWarehouseDataShell>
  )
}
