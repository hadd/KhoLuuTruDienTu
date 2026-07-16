import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { Card } from '@/components/ui/card'
import { ArchiveWarehouseFondGrid } from '@/features/archive-warehouse/components/ArchiveWarehouseFondGrid'
import {
  ArchiveWarehouseSearchFilters,
  buildWarehouseSearchApiParams,
  hasWarehouseFilterCriteria,
  isFondOnlyWarehouseFilter,
} from '@/features/archive-warehouse/components/ArchiveWarehouseSearchFilters'
import { ArchiveWarehouseSearchResults } from '@/features/archive-warehouse/components/ArchiveWarehouseSearchResults'
import {
  archiveWarehouseFondsQueryOptions,
  archiveWarehouseSearchQueryOptions,
} from '@/features/archive-warehouse/queries'
import type { ArchiveDataHubSearchT } from '@/features/archive-warehouse/schemas'
import { DEFAULT_LIST_PAGE_LIMIT, LIST_PAGE_SIZE_OPTIONS } from '@/lib/schemas/list-page-search'

const routeApi = getRouteApi('/app/archive-warehouse/')

interface ArchiveWarehouseFondsPageProps {
  embedded?: boolean
}

export function ArchiveWarehouseFondsPage({
  embedded = false,
}: ArchiveWarehouseFondsPageProps) {
  const { t } = useTranslation('archive-warehouse')
  const navigateToFond = useNavigate()
  const search = routeApi.useSearch() as ArchiveDataHubSearchT
  const navigate = routeApi.useNavigate()

  const q = search.q ?? ''
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT

  const [inputValue, setInputValue] = useState(q)

  const { data: fondsData, isPending } = useQuery(archiveWarehouseFondsQueryOptions())
  const fonds = fondsData?.items ?? []

  const filterValues = {
    q,
    searchFondId: search.searchFondId,
    dossierTypeId: search.dossierTypeId,
    documentTypeId: search.documentTypeId,
    editorName: search.editorName,
    editCompletedAtFrom: search.editCompletedAtFrom,
    editCompletedAtTo: search.editCompletedAtTo,
    archivedAtFrom: search.archivedAtFrom,
    archivedAtTo: search.archivedAtTo,
  }

  const isSearchActive =
    hasWarehouseFilterCriteria(filterValues) &&
    !isFondOnlyWarehouseFilter(filterValues)
  const searchParams = isSearchActive
    ? buildWarehouseSearchApiParams(filterValues, { page, limit })
    : null

  const {
    data: searchData,
    isPending: isSearchPending,
    isFetching: isSearchFetching,
  } = useQuery(archiveWarehouseSearchQueryOptions(searchParams))

  const searchItems = searchData?.items ?? []
  const totalPages = Math.max(
    1,
    Math.ceil((searchData?.total ?? 0) / limit) || 1,
  )
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const listLoading = isSearchPending || isSearchFetching

  useEffect(() => {
    if (isPending || fonds.length !== 1 || !fonds[0] || isSearchActive) return
    void navigateToFond({
      to: '/app/archive-dossiers/$fondId',
      params: { fondId: fonds[0].id },
    })
  }, [fonds, isPending, isSearchActive, navigateToFond])

  useEffect(() => {
    setInputValue(q)
  }, [q])

  useEffect(() => {
    if (!isSearchActive || listLoading || !searchData) return
    if (safePage !== page) {
      void navigate({
        search: (prev) => ({ ...prev, page: safePage }),
        replace: true,
      })
    }
  }, [safePage, page, navigate, listLoading, searchData, isSearchActive])

  const sortedFonds = useMemo(
    () => [...fonds].sort((a, b) => a.fondName.localeCompare(b.fondName)),
    [fonds],
  )

  function applySearch(patch?: Partial<ArchiveDataHubSearchT>) {
    void navigate({
      search: (prev) => ({
        ...prev,
        ...patch,
        q: (patch && 'q' in patch ? patch.q : inputValue.trim()) || undefined,
        page: 1,
        mode: (patch && 'q' in patch ? patch.q : inputValue.trim())
          ? 'content'
          : 'metadata',
      }),
      replace: true,
    })
  }

  function submitSearch() {
    applySearch({ q: inputValue.trim() || undefined })
  }

  function clearFilters() {
    setInputValue('')
    void navigate({
      search: {
        tab: 'dossiers',
        page: 1,
        limit,
      },
      replace: true,
    })
  }

  function openHit(
    hit: { entityId: string; fondId?: string | null },
    match?: {
      fileName?: string | null
      page?: number | null
      bbox?: number[] | null
    },
  ) {
    const fondId = hit.fondId
    if (!fondId) return
    const highlightBbox =
      match?.bbox && match.bbox.length >= 4
        ? match.bbox.slice(0, 4).join(',')
        : undefined
    void navigateToFond({
      to: '/app/archive-dossiers/$fondId/$dossierId',
      params: { fondId, dossierId: hit.entityId },
      search: {
        fileName: match?.fileName ?? undefined,
        highlightPage: match?.page && match.page > 0 ? match.page : undefined,
        highlightBbox,
      },
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('page.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('page.description')}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">
          {t('page.searchSectionTitle')}
        </h2>
        <ArchiveWarehouseSearchFilters
          values={filterValues}
          searchInput={inputValue}
          onSearchInputChange={setInputValue}
          onSubmitSearch={submitSearch}
          onChange={(patch) => {
            const next = {
              ...filterValues,
              ...patch,
              q:
                patch && 'q' in patch
                  ? patch.q
                  : inputValue.trim() || filterValues.q,
            }
            if (isFondOnlyWarehouseFilter(next) && next.searchFondId) {
              void navigateToFond({
                to: '/app/archive-dossiers/$fondId',
                params: { fondId: next.searchFondId },
              })
              return
            }
            void navigate({
              search: (prev) => ({
                ...prev,
                ...patch,
                page: 1,
              }),
              replace: true,
            })
          }}
          onClear={clearFilters}
          fonds={sortedFonds}
        />

        {isSearchActive ? (
          <>
            <ArchiveWarehouseSearchResults
              items={searchItems}
              isLoading={listLoading}
              tookMs={searchData?.took_ms}
              message={searchData?.message}
              mode={searchParams?.mode}
              onSelect={(hit, match) => openHit(hit, match)}
            />
            {searchItems.length > 0 ? (
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
          </>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-foreground">{t('page.fondFilterLabel')}</h2>
        {sortedFonds.length === 0 && !isPending ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            {t('page.fondListEmpty')}
          </Card>
        ) : (
          <ArchiveWarehouseFondGrid
            fonds={sortedFonds}
            onSelect={(fondId) => {
              void navigateToFond({
                to: '/app/archive-dossiers/$fondId',
                params: { fondId },
              })
            }}
          />
        )}
        {!isSearchActive && sortedFonds.length > 1 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            {t('page.selectFondFirst')}
          </Card>
        ) : null}
      </section>
    </div>
  )
}
