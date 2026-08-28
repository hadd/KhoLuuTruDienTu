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
import { executeDirectDestroyCandidates, transferToDisposalProposal } from '@/features/archive-disposal/api/archiveDisposalClient'
import { ArchiveDisposalCandidateFilters } from '@/features/archive-disposal/components/ArchiveDisposalCandidateFilters'
import { DisposalCandidatesTable } from '@/features/archive-disposal/components/DisposalCandidatesTable'
import {
  isAppendToDisposalCatalog,
  notifyDisposalTransferResult,
} from '@/features/archive-disposal/lib/disposalTransferNotifications'
import { useDisposalCouncilAccess } from '@/features/archive-disposal-council/hooks/useDisposalCouncilAccess'
import { disposalSettingsQueryOptions } from '@/features/archive-disposal-council/queries'
import { useArchiveDisposalAccess } from '@/features/archive-disposal/hooks/useArchiveDisposalAccess'
import {
  canSelectItemFond,
  collectSelectableKeysForFond,
  resolveSelectionFondIdFromGroups,
  selectedItemsShareOneFond,
} from '@/features/archive-disposal/lib/disposalCatalogFondSelection'
import { isExpiryAppendToCatalogMode } from '@/features/archive-disposal/lib/disposalExpiryPickerMode'
import { buildDisposalCandidateListParams } from '@/features/archive-disposal/lib/disposalCandidateParams'
import {
  disposalCandidatesQueryKeyPrefix,
  disposalCandidatesQueryOptions,
  disposalCatalogDetailQueryOptions,
  disposalCatalogsQueryOptions,
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

function findCandidateItem(
  groups: Array<DisposalCandidateGroupT>,
  key: string,
): DisposalCandidateItemT | null {
  for (const group of groups) {
    if (group.dossierItem && itemKey(group.dossierItem) === key) {
      return group.dossierItem
    }
    for (const document of group.documentItems) {
      if (itemKey(document) === key) return document
    }
  }
  return null
}

export function ArchiveExpiryDuplicatePage() {
  const { t, i18n } = useTranslation('archive-disposal')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const queryClient = useQueryClient()
  const { canCreateDisposal, canUpdateDisposal } = useArchiveDisposalAccess()
  const { canDestroyDisposal } = useDisposalCouncilAccess()
  const { data: disposalSettings, isPending: isSettingsPending } = useQuery(
    disposalSettingsQueryOptions(),
  )
  const councilReviewEnabled = (disposalSettings as any)?.councilReviewEnabled ?? true
  const showTransferAction = councilReviewEnabled && canCreateDisposal
  const showDestroyAction = !councilReviewEnabled && canDestroyDisposal

  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT
  const q = search.q ?? ''
  const dateLocale = i18n.language.startsWith('vi') ? 'vi' : 'en'

  const [inputValue, setInputValue] = useState(q)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())

  const appendCatalogId = search.disposalAppendCatalogId ?? null

  const { data: appendCatalogDetail } = useQuery({
    ...disposalCatalogDetailQueryOptions(appendCatalogId),
    enabled: Boolean(appendCatalogId),
  })
  const { data: catalogList } = useQuery({
    ...disposalCatalogsQueryOptions({ page: 1, limit: 100 }),
    enabled:
      Boolean(appendCatalogId) &&
      appendCatalogDetail?.catalog.status === 'DRAFT' &&
      !appendCatalogDetail?.catalog.name,
  })

  const appendMode = isExpiryAppendToCatalogMode({
    disposalAppendCatalogId: appendCatalogId,
    catalogStatus: appendCatalogDetail?.catalog.status ?? null,
    councilReviewEnabled,
    canUpdateDisposal,
  })

  const appendCatalogName =
    appendCatalogDetail?.catalog.name ??
    catalogList?.items.find((c) => c.id === appendCatalogId)?.name ??
    ''

  const searchFondFromUrl = (() => {
    const raw = search.searchFondId
    if (Array.isArray(raw)) return raw[0]?.trim() || null
    return raw?.trim() || null
  })()

  const lockedFondId = appendMode
    ? appendCatalogDetail?.catalogFondId?.trim() || searchFondFromUrl || null
    : null

  const listParams = useMemo(
    () => buildDisposalCandidateListParams(search, councilReviewEnabled),
    [search, councilReviewEnabled],
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
  const selectionAnchorFondId = useMemo(
    () => resolveSelectionFondIdFromGroups(groups, selectedKeys, itemKey),
    [groups, selectedKeys],
  )

  const transferMutation = useMutation({
    mutationFn: transferToDisposalProposal,
    onSuccess: (result, variables) => {
      notifyDisposalTransferResult(result, {
        appendToCatalog: isAppendToDisposalCatalog(variables.catalogId),
        t,
      })
      setSelectedKeys(new Set())
      void queryClient.invalidateQueries({ queryKey: disposalCandidatesQueryKeyPrefix })
      if (appendMode && appendCatalogId) {
        void queryClient.invalidateQueries({
          queryKey: ['archive-disposal', 'catalog', appendCatalogId],
        })
      }
      void navigate({
        search: (prev) => ({
          ...prev,
          tab: 'expiryReview',
          disposalView: 'proposal',
          disposalCatalogId: appendCatalogId ?? result.catalogId,
          disposalAppendCatalogId: undefined,
          page: 1,
          pickerMode: undefined,
        }),
      })
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })

  const destroyMutation = useMutation({
    mutationFn: async () => {
      const keys = Array.from(selectedKeys)
      if (keys.length === 0) return
      await executeDirectDestroyCandidates(keys)
    },
    onSuccess: () => {
      toast.success(t('disposal.destroySuccess'))
      setSelectedKeys(new Set())
      void queryClient.invalidateQueries({ queryKey: disposalCandidatesQueryKeyPrefix })
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })

  function handleDestroy() {
    if (confirm(t('disposal.confirmDestroyCandidates'))) {
      destroyMutation.mutate()
    }
  }

  function toggleAll(checked: boolean, keys: Array<string>) {
    if (!checked) {
      setSelectedKeys(new Set())
      return
    }
    
    if (!councilReviewEnabled) {
      setSelectedKeys(new Set(keys))
      return
    }

    const anchor = selectionAnchorFondId ?? lockedFondId
    if (anchor) {
      setSelectedKeys(
        new Set(collectSelectableKeysForFond(groups, itemKey, anchor, 'dossier')),
      )
      return
    }
    const firstKey = keys[0]
    const firstItem = firstKey ? findCandidateItem(groups, firstKey) : null
    const fond = firstItem?.fondId?.trim()
    if (!fond) {
      toast.error(t('disposal.missingFond'))
      return
    }
    setSelectedKeys(
      new Set(collectSelectableKeysForFond(groups, itemKey, fond, 'dossier')),
    )
  }

  function toggleOne(
    key: string,
    checked: boolean,
    context: { dossierId: string; kind: 'dossier' | 'document' },
  ) {
    if (checked) {
      const item = findCandidateItem(groups, key)
      if (!item) return
      if (
        councilReviewEnabled &&
        !canSelectItemFond(
          item.fondId,
          selectionAnchorFondId,
          lockedFondId,
        )
      ) {
        toast.error(
          !item.fondId?.trim()
            ? t('disposal.missingFond')
            : t('disposal.sameFondRequired'),
        )
        return
      }

      if (item.duplicateGroupId) {
        const allGroupItems = groups.flatMap(g => [g.dossierItem, ...g.documentItems]).filter(i => i && i.duplicateGroupId === item.duplicateGroupId)
        const currentlySelectedCount = allGroupItems.filter(i => selectedKeys.has(itemKey(i!))).length
        if (currentlySelectedCount === allGroupItems.length - 1) {
          toast.error('Bạn phải giữ lại ít nhất 1 bản gốc trong nhóm trùng lặp này.')
          return
        }
      }
    }
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
    const fondCheck = selectedItemsShareOneFond(selectedItems)
    if (!fondCheck.ok) {
      toast.error(t('disposal.sameFondRequired'))
      return
    }
    if (lockedFondId && fondCheck.fondId !== lockedFondId) {
      toast.error(t('disposal.sameFondRequired'))
      return
    }
    transferMutation.mutate({
      ...(appendMode && appendCatalogId ? { catalogId: appendCatalogId } : {}),
      items: selectedItems.map((item) => ({
        dossierId: item.dossierId,
        fileId: item.fileId,
        source: resolveTransferSource(item),
      })),
    })
  }

  function navigateBackToCatalog() {
    void navigate({
      search: (prev) => ({
        ...prev,
        tab: 'expiryReview',
        disposalView: 'proposal',
        disposalCatalogId: appendCatalogId ?? prev.disposalCatalogId,
        disposalAppendCatalogId: undefined,
        page: 1,
      }),
    })
  }

  const showAppendTransfer = appendMode && canUpdateDisposal
  const showCreateTransfer = !appendMode && showTransferAction

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
        disposalView: prev.disposalView,
        disposalCatalogId: prev.disposalCatalogId,
        searchFondId: prev.searchFondId,
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
      {appendMode && appendCatalogName ? (
        <p className="text-sm text-muted-foreground">
          {t('disposal.pickerActiveCatalog', { name: appendCatalogName })}
        </p>
      ) : null}
      <ArchiveDisposalCandidateFilters
        search={search}
        inputValue={inputValue}
        onInputValueChange={setInputValue}
        onSubmitSearch={submitSearch}
        onNavigate={patchSearch}
        onClearFilters={clearFilters}
        searchPlaceholder={t('disposal.searchPlaceholder')}
        trailing={
          <>
            {appendMode ? (
              <Button type="button" variant="outline" onClick={navigateBackToCatalog}>
                {t('disposal.backToCatalog')}
              </Button>
            ) : null}
            {showAppendTransfer || showCreateTransfer ? (
              <Button
                type="button"
                disabled={selectedCount === 0 || transferMutation.isPending}
                onClick={handleTransfer}
              >
                {transferMutation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Send className="mr-2 size-4" />
                )}
                {appendMode
                  ? t('disposal.addToCatalog', { count: selectedCount })
                  : t('disposal.transferAction', { count: selectedCount })}
              </Button>
            ) : showDestroyAction ? (
              <Button
                variant="destructive"
                disabled={selectedCount === 0 || destroyMutation.isPending}
                onClick={handleDestroy}
              >
                {destroyMutation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 size-4" />
                )}
                {t('disposal.destroyAction', { count: selectedCount })}
              </Button>
            ) : null}
          </>
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
              lockedFondId={lockedFondId}
              selectionAnchorFondId={selectionAnchorFondId}
              councilReviewEnabled={councilReviewEnabled}
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
