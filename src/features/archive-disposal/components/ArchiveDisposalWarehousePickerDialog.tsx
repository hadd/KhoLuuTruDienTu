import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import { ListPageSearchInput } from '@/components/common/list-page/ListPageSearchInput'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  stickyTableHeaderClassName,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { transferToDisposalProposal } from '@/features/archive-disposal/api/archiveDisposalClient'
import { isAppendToDisposalCatalog, notifyDisposalTransferResult } from '@/features/archive-disposal/lib/disposalTransferNotifications'
import { archiveWarehouseDossiersQueryOptions } from '@/features/archive-warehouse/queries'
import { LIST_PAGE_SIZE_OPTIONS } from '@/lib/schemas/list-page-search'
import { formatDate } from '@/lib/utils/date'
import { translateError } from '@/lib/utils/translate-error'
import { Badge } from '@/components/ui/badge'

export type ArchiveDisposalWarehousePickerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalogId: string
  onTransferSuccess?: () => void
}

export function ArchiveDisposalWarehousePickerDialog({
  open,
  onOpenChange,
  catalogId,
  onTransferSuccess,
}: ArchiveDisposalWarehousePickerDialogProps) {
  const { t } = useTranslation('archive-warehouse')
  const { t: tDisposal } = useTranslation('archive-disposal')
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [searchQuery, setSearchQuery] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { data, isPending, isFetching } = useQuery({
    ...archiveWarehouseDossiersQueryOptions({
      page,
      limit,
      search: searchQuery || undefined,
      status: 'ARCHIVED',
    }),
    enabled: open,
  })

  const items = data?.items ?? []
  const totalPages = Math.max(1, data?.totalPages ?? 1)
  const listLoading = isPending || isFetching
  const selectedDossierIds = Array.from(selectedIds)
  const hasSelection = selectedDossierIds.length > 0
  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id))
  const someSelected = items.some((item) => selectedIds.has(item.id)) && !allSelected

  const transferMutation = useMutation({
    mutationFn: transferToDisposalProposal,
    onSuccess: (result) => {
      notifyDisposalTransferResult(result, {
        appendToCatalog: isAppendToDisposalCatalog(catalogId),
        t: tDisposal,
      })
      setSelectedIds(new Set())
      onTransferSuccess?.()
      onOpenChange(false)
      void queryClient.invalidateQueries({
        queryKey: ['archive-disposal', 'catalog', catalogId],
      })
    },
    onError: (error) => toast.error(translateError(error)),
  })

  function submitSearch() {
    setSearchQuery(inputValue.trim())
    setPage(1)
  }

  function toggleDossierSelection(dossierId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(dossierId)
      else next.delete(dossierId)
      return next
    })
  }

  function toggleSelectAllOnPage(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const item of items) {
        if (checked) next.add(item.id)
        else next.delete(item.id)
      }
      return next
    })
  }

  function handleTransfer() {
    transferMutation.mutate({
      catalogId,
      items: selectedDossierIds.map((dossierId) => ({
        dossierId,
        source: 'WAREHOUSE' as const,
      })),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] sm:max-w-6xl flex-col gap-0 p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>{tDisposal('proposal.addFromWarehouse')}</DialogTitle>
          <DialogDescription>{tDisposal('disposal.pickerHint')}</DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 items-center gap-3 border-b px-6 pb-4">
          <ListPageSearchInput
            className="w-96"
            value={inputValue}
            onChange={setInputValue}
            onSearch={submitSearch}
            placeholder={t('page.searchPlaceholder')}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-muted/50 p-6">
          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader className={stickyTableHeaderClassName}>
                <TableRow>
                  <TableHead className="w-12 text-center">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={toggleSelectAllOnPage}
                      aria-label={t('table.selectAll')}
                    />
                  </TableHead>
                  <TableHead>{t('table.dossierName')}</TableHead>
                  <TableHead>{t('table.fond')}</TableHead>
                  <TableHead>{t('table.dossierType')}</TableHead>
                  <TableHead>{t('table.archivedAt')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      {t('page.noMatch')}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow
                      key={item.id}
                      className={selectedIds.has(item.id) ? 'bg-primary/5' : ''}
                    >
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={(checked) =>
                            toggleDossierSelection(item.id, !!checked)
                          }
                          aria-label={t('table.select')}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.name}
                        {item.code ? (
                          <span className="ml-2 text-muted-foreground">
                            ({item.code})
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>{item.fondName}</TableCell>
                      <TableCell>
                        {item.dossierTypeName ? (
                          <Badge variant="outline">{item.dossierTypeName}</Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {item.archivedAt ? formatDate(item.archivedAt) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t p-4 px-6 bg-background">
          <ListPagePagination
            page={page}
            totalPages={totalPages}
            limit={limit}
            pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l)
              setPage(1)
            }}
          />
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {tDisposal('proposal.cancel')}
            </Button>
            <Button
              disabled={!hasSelection || transferMutation.isPending}
              onClick={handleTransfer}
            >
              {transferMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Plus className="mr-2 size-4" />
              )}
              {tDisposal('disposal.addToCatalog', { count: selectedDossierIds.length })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
