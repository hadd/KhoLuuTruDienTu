import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Loader2, Plus, Save, Send, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ListPagePagination } from '@/components/common/list-page/ListPagePagination'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  createDisposalCatalog,
  deleteDisposalCatalog,
  removeDisposalCatalogItem,
  submitDisposalCatalog,
  updateDisposalCatalog,
  updateDisposalCatalogItem,
} from '@/features/archive-disposal/api/archiveDisposalClient'
import { useArchiveDisposalAccess } from '@/features/archive-disposal/hooks/useArchiveDisposalAccess'
import {
  disposalCatalogDetailQueryOptions,
  disposalCatalogsQueryKeyPrefix,
  disposalCatalogsQueryOptions,
} from '@/features/archive-disposal/queries'
import { DEFAULT_LIST_PAGE_LIMIT, LIST_PAGE_SIZE_OPTIONS } from '@/lib/schemas/list-page-search'
import { translateError } from '@/lib/utils/translate-error'

const routeApi = getRouteApi('/app/archive-warehouse/')

export function ArchiveDisposalProposalPage() {
  const { t } = useTranslation('archive-disposal')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const queryClient = useQueryClient()
  const {
    canCreateDisposal,
    canUpdateDisposal,
    canSubmitDisposal,
  } = useArchiveDisposalAccess()

  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT
  const selectedCatalogId = search.disposalCatalogId ?? null

  const [formName, setFormName] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10))
  const [formNotes, setFormNotes] = useState('')
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({})
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const { data: catalogList, isPending: isListPending } = useQuery(
    disposalCatalogsQueryOptions({ page, limit }),
  )
  const { data: catalogDetail, isPending: isDetailPending } = useQuery(
    disposalCatalogDetailQueryOptions(selectedCatalogId),
  )

  useEffect(() => {
    if (!catalogDetail?.catalog) return
    setFormName(catalogDetail.catalog.name)
    setFormDate(catalogDetail.catalog.catalogDate)
    setFormNotes(catalogDetail.catalog.notes)
    const drafts: Record<string, string> = {}
    for (const item of catalogDetail.items) {
      drafts[item.id] = item.reason
    }
    setReasonDrafts(drafts)
  }, [catalogDetail])

  const createMutation = useMutation({
    mutationFn: createDisposalCatalog,
    onSuccess: (catalog) => {
      toast.success(t('proposal.createSuccess'))
      void queryClient.invalidateQueries({ queryKey: disposalCatalogsQueryKeyPrefix })
      void navigate({
        search: (prev) => ({
          ...prev,
          disposalCatalogId: catalog.id,
          page: 1,
        }),
      })
    },
    onError: (error) => toast.error(translateError(error)),
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      updateDisposalCatalog(selectedCatalogId!, {
        name: formName,
        catalogDate: formDate,
        notes: formNotes,
      }),
    onSuccess: () => {
      toast.success(t('proposal.saveSuccess'))
      void queryClient.invalidateQueries({ queryKey: disposalCatalogsQueryKeyPrefix })
      void queryClient.invalidateQueries({
        queryKey: ['archive-disposal', 'catalog', selectedCatalogId],
      })
    },
    onError: (error) => toast.error(translateError(error)),
  })

  const submitMutation = useMutation({
    mutationFn: () => submitDisposalCatalog(selectedCatalogId!),
    onSuccess: () => {
      toast.success(t('proposal.submitSuccess'))
      void queryClient.invalidateQueries({ queryKey: disposalCatalogsQueryKeyPrefix })
      void queryClient.invalidateQueries({
        queryKey: ['archive-disposal', 'catalog', selectedCatalogId],
      })
    },
    onError: (error) => toast.error(translateError(error)),
  })

  const saveReasonMutation = useMutation({
    mutationFn: ({ itemId, reason }: { itemId: string; reason: string }) =>
      updateDisposalCatalogItem(selectedCatalogId!, itemId, { reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['archive-disposal', 'catalog', selectedCatalogId],
      })
    },
    onError: (error) => toast.error(translateError(error)),
  })

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      removeDisposalCatalogItem(selectedCatalogId!, itemId),
    onSuccess: () => {
      toast.success(t('proposal.itemRemoved'))
      void queryClient.invalidateQueries({
        queryKey: ['archive-disposal', 'catalog', selectedCatalogId],
      })
    },
    onError: (error) => toast.error(translateError(error)),
  })

  const deleteCatalogMutation = useMutation({
    mutationFn: () => deleteDisposalCatalog(selectedCatalogId!),
    onSuccess: () => {
      toast.success(t('proposal.deleteSuccess'))
      setDeleteDialogOpen(false)
      void queryClient.invalidateQueries({ queryKey: disposalCatalogsQueryKeyPrefix })
      void navigate({
        search: (prev) => ({
          ...prev,
          disposalCatalogId: undefined,
          page: 1,
        }),
      })
    },
    onError: (error) => toast.error(translateError(error)),
  })

  const catalogs = catalogList?.items ?? []
  const isDraft = catalogDetail?.catalog.status === 'DRAFT'
  const canEditDraft = isDraft && canUpdateDisposal
  const canPickFromWarehouse = canEditDraft && Boolean(selectedCatalogId)
  const totalPages = catalogList?.totalPages ?? 1

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-end gap-2">
          {canUpdateDisposal ? (
            <Button
              variant="outline"
              disabled={!canPickFromWarehouse}
              title={
                canPickFromWarehouse
                  ? undefined
                  : t('proposal.addFromWarehouseDisabledHint')
              }
              onClick={() => {
                if (!selectedCatalogId) return
                void navigate({
                  search: (prev) => ({
                    ...prev,
                    tab: 'dossiers',
                    browseView: 'fonds',
                    pickerMode: true,
                    disposalCatalogId: selectedCatalogId,
                    page: 1,
                  }),
                })
              }}
            >
              {t('proposal.addFromWarehouse')}
            </Button>
          ) : null}
          {canCreateDisposal ? (
            <Button
              onClick={() =>
                createMutation.mutate({
                  name: t('proposal.defaultName'),
                  catalogDate: new Date().toISOString().slice(0, 10),
                })
              }
              disabled={createMutation.isPending}
            >
              <Plus className="mr-2 size-4" />
              {t('proposal.createNew')}
            </Button>
          ) : null}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="overflow-auto p-3">
          <h3 className="mb-2 text-sm font-medium">{t('proposal.catalogList')}</h3>
          {isListPending ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : catalogs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('proposal.noCatalogs')}
            </p>
          ) : (
            <div className="space-y-1">
              {catalogs.map((catalog) => (
                <button
                  key={catalog.id}
                  type="button"
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    selectedCatalogId === catalog.id
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent hover:bg-muted/50'
                  }`}
                  onClick={() => {
                    void navigate({
                      search: (prev) => ({
                        ...prev,
                        disposalCatalogId: catalog.id,
                      }),
                    })
                  }}
                >
                  <div className="font-medium">{catalog.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{catalog.code}</span>
                    <Badge variant="outline">{t(`proposal.status.${catalog.status}`)}</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
          <ListPagePagination
            page={page}
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
        </Card>

        <Card className="min-h-0 overflow-auto p-4">
          {!selectedCatalogId ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {t('proposal.selectCatalogHint')}
            </p>
          ) : isDetailPending ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : catalogDetail ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="catalog-name">{t('proposal.fields.name')}</Label>
                  <Input
                    id="catalog-name"
                    value={formName}
                    disabled={!canEditDraft}
                    onChange={(event) => setFormName(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="catalog-date">{t('proposal.fields.date')}</Label>
                  <Input
                    id="catalog-date"
                    type="date"
                    value={formDate}
                    disabled={!canEditDraft}
                    onChange={(event) => setFormDate(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="catalog-notes">{t('proposal.fields.notes')}</Label>
                <Textarea
                  id="catalog-notes"
                  value={formNotes}
                  disabled={!canEditDraft}
                  onChange={(event) => setFormNotes(event.target.value)}
                />
              </div>

              {canEditDraft ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={saveMutation.isPending}
                    onClick={() => saveMutation.mutate()}
                  >
                    <Save className="mr-2 size-4" />
                    {t('proposal.save')}
                  </Button>
                  {canSubmitDisposal ? (
                    <Button
                      disabled={submitMutation.isPending}
                      onClick={() => submitMutation.mutate()}
                    >
                      <Send className="mr-2 size-4" />
                      {t('proposal.submit')}
                    </Button>
                  ) : null}
                  <Button
                    variant="destructive"
                    disabled={deleteCatalogMutation.isPending}
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="mr-2 size-4" />
                    {t('proposal.delete')}
                  </Button>
                </div>
              ) : null}

              <div>
                <h4 className="mb-2 text-sm font-medium">{t('proposal.itemsTitle')}</h4>
                {catalogDetail.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('proposal.itemsEmpty')}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('proposal.table.dossier')}</TableHead>
                        <TableHead>{t('proposal.table.source')}</TableHead>
                        <TableHead>{t('proposal.table.reason')}</TableHead>
                        {canEditDraft ? <TableHead className="w-12" /> : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {catalogDetail.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.dossierName ?? item.dossierId}</TableCell>
                          <TableCell>{t(`proposal.source.${item.source}`)}</TableCell>
                          <TableCell>
                            {canEditDraft ? (
                              <Input
                                value={reasonDrafts[item.id] ?? ''}
                                placeholder={t('proposal.reasonPlaceholder')}
                                onChange={(event) =>
                                  setReasonDrafts((prev) => ({
                                    ...prev,
                                    [item.id]: event.target.value,
                                  }))
                                }
                                onBlur={() => {
                                  const reason = reasonDrafts[item.id]?.trim() ?? ''
                                  if (reason !== item.reason) {
                                    saveReasonMutation.mutate({ itemId: item.id, reason })
                                  }
                                }}
                              />
                            ) : (
                              item.reason || '—'
                            )}
                          </TableCell>
                          {canEditDraft ? (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItemMutation.mutate(item.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('proposal.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('proposal.deleteConfirmDescription', {
                name: catalogDetail?.catalog.name ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCatalogMutation.isPending}>
              {t('proposal.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteCatalogMutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                deleteCatalogMutation.mutate()
              }}
            >
              {deleteCatalogMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {t('proposal.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
