import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Loader2, Send } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { transferToDisposalProposal } from '@/features/archive-disposal/api/archiveDisposalClient'
import { ArchiveDisposalCandidateFilters } from '@/features/archive-disposal/components/ArchiveDisposalCandidateFilters'
import { useArchiveDisposalAccess } from '@/features/archive-disposal/hooks/useArchiveDisposalAccess'
import { buildDisposalCandidateListParams } from '@/features/archive-disposal/lib/disposalCandidateParams'
import {
  disposalCandidatesQueryKeyPrefix,
  disposalCandidatesQueryOptions,
} from '@/features/archive-disposal/queries'
import type {
  DisposalCandidateItemT,
  DisposalProposalItemSourceT,
} from '@/features/archive-disposal/types'
import type { ArchiveDataHubSearchT } from '@/features/archive-warehouse/schemas'
import { DEFAULT_LIST_PAGE_LIMIT, LIST_PAGE_SIZE_OPTIONS } from '@/lib/schemas/list-page-search'
import { formatDate } from '@/lib/utils/date'
import { translateError } from '@/lib/utils/translate-error'

const routeApi = getRouteApi('/app/archive-warehouse/')

function resolveTransferSource(
  item: DisposalCandidateItemT,
): DisposalProposalItemSourceT {
  if (item.categories.includes('expired')) return 'EXPIRED'
  if (item.categories.includes('expiring_soon')) return 'EXPIRING_SOON'
  if (item.categories.includes('duplicate')) return 'DUPLICATE'
  return 'EXPIRED'
}

function categoryBadges(item: DisposalCandidateItemT, t: (key: string) => string) {
  return item.categories.map((category) => (
    <Badge key={category} variant="outline" className="mr-1">
      {t(`disposal.category.${category}`)}
    </Badge>
  ))
}

export function ArchiveExpiryDuplicatePage() {
  const { t, i18n } = useTranslation('archive-disposal')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const queryClient = useQueryClient()
  const { canCreateDisposal } = useArchiveDisposalAccess()

  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT
  const q = search.q ?? ''

  const [inputValue, setInputValue] = useState(q)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())

  const listParams = useMemo(
    () => buildDisposalCandidateListParams(search),
    [search],
  )

  useEffect(() => {
    setInputValue(q)
  }, [q])

  useEffect(() => {
    setSelectedKeys(new Set())
  }, [listParams])

  const { data, isPending, isFetching } = useQuery(
    disposalCandidatesQueryOptions(listParams),
  )

  const items = data?.items ?? []
  const totalPages = data?.totalPages ?? 1
  const safePage = Math.min(Math.max(page, 1), totalPages)

  const transferMutation = useMutation({
    mutationFn: transferToDisposalProposal,
    onSuccess: (result) => {
      toast.success(t('disposal.transferSuccess'))
      setSelectedKeys(new Set())
      void queryClient.invalidateQueries({ queryKey: disposalCandidatesQueryKeyPrefix })
      void navigate({
        search: (prev) => ({
          ...prev,
          tab: 'disposalProposal',
          disposalCatalogId: result.catalogId,
          page: 1,
        }),
      })
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })

  function itemKey(item: DisposalCandidateItemT) {
    return item.fileId ? `${item.dossierId}:${item.fileId}` : item.dossierId
  }

  const selectableKeys = items.map(itemKey)
  const selectedCount = selectableKeys.filter((key) => selectedKeys.has(key)).length
  const allSelected =
    selectableKeys.length > 0 && selectedCount === selectableKeys.length

  function toggleAll(checked: boolean) {
    setSelectedKeys(checked ? new Set(selectableKeys) : new Set())
  }

  function toggleOne(key: string, checked: boolean) {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  function handleTransfer() {
    const selectedItems = items.filter((item) => selectedKeys.has(itemKey(item)))
    if (selectedItems.length === 0) return
    transferMutation.mutate({
      items: selectedItems.map((item) => ({
        dossierId: item.dossierId,
        fileId: item.fileId,
        source: resolveTransferSource(item),
      })),
    })
  }

  function submitSearch() {
    void navigate({
      search: (prev) => ({
        ...prev,
        q: inputValue.trim() || undefined,
        page: 1,
      }),
    })
  }

  function patchSearch(patch: Partial<ArchiveDataHubSearchT>) {
    void navigate({
      search: (prev) => ({ ...prev, ...patch }),
    })
  }

  function clearFilters() {
    setInputValue('')
    void navigate({
      search: (prev) => ({
        tab: prev.tab,
        page: 1,
        limit: prev.limit,
      }),
    })
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
      <ArchiveDisposalCandidateFilters
        search={search}
        inputValue={inputValue}
        onInputValueChange={setInputValue}
        onSubmitSearch={submitSearch}
        onNavigate={patchSearch}
        onClearFilters={clearFilters}
        trailing={
          canCreateDisposal ? (
            <Button
              disabled={selectedCount === 0 || transferMutation.isPending}
              onClick={handleTransfer}
            >
              {transferMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Send className="mr-2 size-4" />
              )}
              {t('disposal.transferAction', { count: selectedCount })}
            </Button>
          ) : null
        }
      />

      <Card className="min-h-0 flex-1 overflow-hidden">
        {isPending || isFetching ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {data?.message ?? t('disposal.empty')}
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => toggleAll(checked === true)}
                      aria-label={t('disposal.selectAll')}
                    />
                  </TableHead>
                  <TableHead>{t('disposal.table.dossierName')}</TableHead>
                  <TableHead>{t('disposal.table.fond')}</TableHead>
                  <TableHead>{t('disposal.table.retention')}</TableHead>
                  <TableHead>{t('disposal.table.expiresAt')}</TableHead>
                  <TableHead>{t('disposal.table.category')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const key = itemKey(item)
                  return (
                    <TableRow key={key}>
                      <TableCell>
                        <Checkbox
                          checked={selectedKeys.has(key)}
                          onCheckedChange={(checked) => toggleOne(key, checked === true)}
                          aria-label={item.dossierName}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{item.dossierName}</TableCell>
                      <TableCell>{item.fondName ?? '—'}</TableCell>
                      <TableCell>{item.retentionPeriodName ?? '—'}</TableCell>
                      <TableCell>
                        {item.expiresAt
                          ? formatDate(
                              item.expiresAt,
                              'P',
                              i18n.language.startsWith('vi') ? 'vi' : 'en',
                            )
                          : '—'}
                      </TableCell>
                      <TableCell>{categoryBadges(item, t)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <ListPagePagination
        page={safePage}
        totalPages={totalPages}
        pageSize={limit}
        pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
        onPageChange={(nextPage) => {
          void navigate({ search: (prev) => ({ ...prev, page: nextPage }) })
        }}
        onPageSizeChange={(nextLimit) => {
          void navigate({
            search: (prev) => ({ ...prev, limit: nextLimit, page: 1 }),
          })
        }}
      />
    </div>
  )
}
