import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Loader2, Send, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { transferToDisposalProposal } from '@/features/archive-disposal/api/archiveDisposalClient'
import { ArchiveDisposalCandidateFilters } from '@/features/archive-disposal/components/ArchiveDisposalCandidateFilters'
import { DisposalCandidatesTable } from '@/features/archive-disposal/components/DisposalCandidatesTable'
import { DisposalWorkflowConfigSection } from '@/features/archive-disposal-council/components/DisposalWorkflowConfigSection'
import { useDisposalCouncilAccess } from '@/features/archive-disposal-council/hooks/useDisposalCouncilAccess'
import { disposalSettingsQueryOptions } from '@/features/archive-disposal-council/queries'
import { useArchiveDisposalAccess } from '@/features/archive-disposal/hooks/useArchiveDisposalAccess'
import { buildDisposalCandidateListParams } from '@/features/archive-disposal/lib/disposalCandidateParams'
import {
  disposalCandidatesQueryKeyPrefix,
  disposalCandidatesQueryOptions,
} from '@/features/archive-disposal/queries'
import type {
  DisposalCandidateGroupT,
  DisposalCandidateItemT,
  DisposalProposalItemSourceT,
} from '@/features/archive-disposal/types'
import type { ArchiveDataHubSearchT } from '@/features/archive-warehouse/schemas'
import { DEFAULT_LIST_PAGE_LIMIT, LIST_PAGE_SIZE_OPTIONS } from '@/lib/schemas/list-page-search'
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

function itemKey(item: DisposalCandidateItemT) {
  return item.fileId ? `${item.dossierId}:${item.fileId}` : item.dossierId
}

function collectSelectedItems(
  groups: Array<DisposalCandidateGroupT>,
  selectedKeys: Set<string>,
) {
  const items: Array<DisposalCandidateItemT> = []
  for (const group of groups) {
    if (group.dossierItem && selectedKeys.has(itemKey(group.dossierItem))) {
      items.push(group.dossierItem)
    }
    for (const document of group.documentItems) {
      if (selectedKeys.has(itemKey(document))) {
        items.push(document)
      }
    }
  }
  return items
}

export function ArchiveExpiryDuplicatePage() {
  const { t, i18n } = useTranslation('archive-disposal')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const queryClient = useQueryClient()
  const { canCreateDisposal } = useArchiveDisposalAccess()
  const { canDestroyDisposal } = useDisposalCouncilAccess()
  const { data: disposalSettings, isPending: isSettingsPending } = useQuery(
    disposalSettingsQueryOptions(),
  )
  const councilReviewEnabled = disposalSettings?.councilReviewEnabled ?? true
  const showTransferAction = councilReviewEnabled && canCreateDisposal
  const showDestroyAction = !councilReviewEnabled && canDestroyDisposal

  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT
  const q = search.q ?? ''
  const dateLocale = i18n.language.startsWith('vi') ? 'vi' : 'en'

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

  const groups = data?.groups ?? []
  const totalPages = data?.totalPages ?? 1
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const selectedCount = selectedKeys.size

  const transferMutation = useMutation({
    mutationFn: transferToDisposalProposal,
    onSuccess: (result) => {
      toast.success(t('disposal.transferSuccess'))
      setSelectedKeys(new Set())
      void queryClient.invalidateQueries({ queryKey: disposalCandidatesQueryKeyPrefix })
      void navigate({
        search: (prev) => ({
          ...prev,
          tab: 'expiryReview',
          disposalView: 'proposal',
          disposalCatalogId: result.catalogId,
          page: 1,
        }),
      })
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })

  function toggleAll(checked: boolean, keys: Array<string>) {
    setSelectedKeys(checked ? new Set(keys) : new Set())
  }

  function toggleOne(
    key: string,
    checked: boolean,
    context: { dossierId: string; kind: 'dossier' | 'document' },
  ) {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(key)
        const group = groups.find((g) => g.dossierId === context.dossierId)
        if (context.kind === 'dossier') {
          group?.documentItems.forEach((doc) => next.delete(itemKey(doc)))
        } else {
          if (group?.dossierItem) {
            next.delete(itemKey(group.dossierItem))
          }
        }
      } else {
        next.delete(key)
      }
      return next
    })
  }

  function handleTransfer() {
    const selectedItems = collectSelectedItems(groups, selectedKeys)
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

  function categoryBadges(item: DisposalCandidateItemT) {
    return item.categories.map((category) => (
      <Badge key={category} variant="outline" className="mr-1">
        {t(`disposal.category.${category}`)}
      </Badge>
    ))
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
      <DisposalWorkflowConfigSection
        settings={disposalSettings}
        isLoading={isSettingsPending}
      />
      <ArchiveDisposalCandidateFilters
        search={search}
        inputValue={inputValue}
        onInputValueChange={setInputValue}
        onSubmitSearch={submitSearch}
        onNavigate={patchSearch}
        onClearFilters={clearFilters}
        searchPlaceholder={t('disposal.searchPlaceholder')}
        trailing={
          showTransferAction ? (
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
          ) : showDestroyAction ? (
            <Button variant="destructive" disabled={selectedCount === 0}>
              <Trash2 className="mr-2 size-4" />
              {t('disposal.destroyAction', { count: selectedCount })}
            </Button>
          ) : null
        }
      />

      <Card className="min-h-0 flex-1 overflow-hidden">
        {isPending || isFetching ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {data?.message ?? t('disposal.empty')}
          </div>
        ) : (
          <div className="overflow-auto">
            <DisposalCandidatesTable
              groups={groups}
              selectedKeys={selectedKeys}
              onToggleAll={toggleAll}
              onToggleOne={toggleOne}
              itemKey={itemKey}
              renderCategoryBadges={categoryBadges}
              dateLocale={dateLocale}
            />
          </div>
        )}
      </Card>

      <ListPagePagination
        page={safePage}
        totalPages={totalPages}
        limit={limit}
        pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
        onPageChange={(nextPage) => {
          void navigate({ search: (prev) => ({ ...prev, page: nextPage }) })
        }}
        onLimitChange={(nextLimit) => {
          void navigate({
            search: (prev) => ({ ...prev, limit: nextLimit, page: 1 }),
          })
        }}
      />
    </div>
  )
}
