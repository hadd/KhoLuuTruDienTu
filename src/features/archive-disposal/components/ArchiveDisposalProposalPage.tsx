import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Loader2, Plus, Save, Send, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  createDisposalCatalog,
  deleteDisposalCatalog,
  removeDisposalCatalogItem,
  submitDisposalCatalog,
  updateDisposalCatalog,
  updateDisposalCatalogItem,
} from '@/features/archive-disposal/api/archiveDisposalClient'
import { DisposalCouncilCreateDialog } from '@/features/archive-disposal-council/components/DisposalCouncilCreateDialog'
import { DisposalCouncilViewDialog } from '@/features/archive-disposal-council/components/DisposalCouncilViewDialog'
import {
  finalizeDisposalCouncilReview,
  upsertDisposalCouncilItemEvaluation,
} from '@/features/archive-disposal-council/api/disposalCouncilClient'
import { useDisposalCouncilAccess } from '@/features/archive-disposal-council/hooks/useDisposalCouncilAccess'
import {
  disposalCouncilDetailQueryOptions,
  disposalCouncilEvaluationsQueryOptions,
  disposalCouncilsQueryOptions,
  disposalSettingsQueryOptions,
} from '@/features/archive-disposal-council/queries'
import {
  DisposalCatalogItemsTable,
  type DisposalDocumentPreviewTargetT,
} from '@/features/archive-disposal/components/DisposalCatalogItemsTable'
import { DisposalDocumentPreviewPanel } from '@/features/archive-disposal/components/DisposalDocumentPreviewPanel'
import { useArchiveDisposalAccess } from '@/features/archive-disposal/hooks/useArchiveDisposalAccess'
import { groupDisposalCatalogItems } from '@/features/archive-disposal/lib/groupDisposalCatalogItems'
import {
  disposalCatalogDetailQueryOptions,
  disposalCatalogsQueryKeyPrefix,
  disposalCatalogsQueryOptions,
} from '@/features/archive-disposal/queries'
import { profileQueryOptions } from '@/features/auth/queries'
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
  const {
    canCreateCouncil,
    canReadCouncil,
    canFinalizeCouncil,
  } = useDisposalCouncilAccess()

  const { data: currentUser } = useQuery(profileQueryOptions)

  const { data: disposalSettings } = useQuery(disposalSettingsQueryOptions())

  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_LIST_PAGE_LIMIT
  const selectedCatalogId = search.disposalCatalogId ?? null

  const [formName, setFormName] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10))
  const [formNotes, setFormNotes] = useState('')
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({})
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [createCouncilOpen, setCreateCouncilOpen] = useState(false)
  const [viewCouncilOpen, setViewCouncilOpen] = useState(false)
  const [evaluationDrafts, setEvaluationDrafts] = useState<Record<string, string>>({})
  const [documentPreview, setDocumentPreview] =
    useState<DisposalDocumentPreviewTargetT | null>(null)
  const [finalizeDialog, setFinalizeDialog] = useState<'APPROVED' | 'REJECTED' | null>(
    null,
  )

  const { data: catalogList, isPending: isListPending } = useQuery(
    disposalCatalogsQueryOptions({ page, limit }),
  )
  const { data: catalogDetail, isPending: isDetailPending } = useQuery(
    disposalCatalogDetailQueryOptions(selectedCatalogId),
  )
  const isPendingReview = catalogDetail?.catalog.status === 'PENDING_SUBMIT'

  const { data: councilsForCatalog } = useQuery({
    ...disposalCouncilsQueryOptions({
      catalogId: selectedCatalogId ?? undefined,
      page: 1,
      limit: 1,
    }),
    enabled:
      Boolean(selectedCatalogId) &&
      (viewCouncilOpen ||
        catalogDetail?.catalog.status === 'PENDING_SUBMIT') &&
      (canReadCouncil || catalogDetail?.catalog.status === 'PENDING_SUBMIT'),
  })
  const viewedCouncilId =
    search.disposalCouncilId ?? councilsForCatalog?.items[0]?.id ?? null

  const { data: councilDetail } = useQuery({
    ...disposalCouncilDetailQueryOptions(viewedCouncilId),
    enabled: Boolean(viewedCouncilId) && isPendingReview,
  })

  const isCouncilMember = useMemo(() => {
    if (!currentUser?.id || !councilDetail?.members) return false
    return councilDetail.members.some((member) => member.userId === currentUser.id)
  }, [councilDetail?.members, currentUser?.id])

  const canAccessCouncilEvaluations =
    isPendingReview &&
    Boolean(viewedCouncilId) &&
    (isCouncilMember || canFinalizeCouncil || canReadCouncil)

  const { data: councilEvaluations } = useQuery({
    ...disposalCouncilEvaluationsQueryOptions(viewedCouncilId),
    enabled: canAccessCouncilEvaluations,
  })

  const evaluationsByItemId = useMemo(() => {
    const map: Record<
      string,
      Array<{ userId: string; userName: string; note: string }>
    > = {}
    for (const row of councilEvaluations?.items ?? []) {
      if (!map[row.itemId]) map[row.itemId] = []
      map[row.itemId]!.push({
        userId: row.userId,
        userName: row.userName,
        note: row.note,
      })
    }
    return map
  }, [councilEvaluations?.items])

  useEffect(() => {
    if (!councilEvaluations?.items || !currentUser?.id) return
    setEvaluationDrafts((prev) => {
      const next = { ...prev }
      for (const row of councilEvaluations.items) {
        if (row.userId === currentUser.id) {
          next[row.itemId] = row.note
        }
      }
      return next
    })
  }, [councilEvaluations?.items, currentUser?.id])

  useEffect(() => {
    if (search.disposalCouncilId && isPendingReview) {
      setViewCouncilOpen(true)
    }
  }, [search.disposalCouncilId, isPendingReview])

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

  const saveEvaluationMutation = useMutation({
    mutationFn: ({ itemId, note }: { itemId: string; note: string }) =>
      upsertDisposalCouncilItemEvaluation(viewedCouncilId!, itemId, note),
    onSuccess: () => {
      toast.success(t('proposal.evaluationSaveSuccess'))
      if (viewedCouncilId) {
        void queryClient.invalidateQueries({
          queryKey: ['archive-disposal', 'council-evaluations', viewedCouncilId],
        })
      }
    },
    onError: (error) => toast.error(translateError(error)),
  })

  const finalizeMutation = useMutation({
    mutationFn: (result: 'APPROVED' | 'REJECTED') =>
      finalizeDisposalCouncilReview(viewedCouncilId!, result),
    onSuccess: () => {
      toast.success(t('proposal.finalizeSuccess'))
      setFinalizeDialog(null)
      void queryClient.invalidateQueries({ queryKey: disposalCatalogsQueryKeyPrefix })
      if (selectedCatalogId) {
        void queryClient.invalidateQueries({
          queryKey: ['archive-disposal', 'catalog', selectedCatalogId],
        })
      }
      if (viewedCouncilId) {
        void queryClient.invalidateQueries({
          queryKey: ['archive-disposal', 'council', viewedCouncilId],
        })
        void queryClient.invalidateQueries({
          queryKey: ['archive-disposal', 'council-evaluations', viewedCouncilId],
        })
      }
    },
    onError: (error) => toast.error(translateError(error)),
  })

  const catalogs = catalogList?.items ?? []
  const catalogGroups = useMemo(
    () =>
      groupDisposalCatalogItems(
        catalogDetail?.items ?? [],
        catalogDetail?.referenceFilesByDossierId ?? {},
      ),
    [catalogDetail?.items, catalogDetail?.referenceFilesByDossierId],
  )
  const isDraft = catalogDetail?.catalog.status === 'DRAFT'
  const isSubmitted = catalogDetail?.catalog.status === 'SUBMITTED'
  const councilReviewEnabled = disposalSettings?.councilReviewEnabled ?? true
  const canEditDraft = isDraft && canUpdateDisposal
  const canPickFromWarehouse = canEditDraft && Boolean(selectedCatalogId)
  const canShortcutCreateCouncil =
    councilReviewEnabled && isSubmitted && canCreateCouncil
  const totalPages = catalogList?.totalPages ?? 1
  const evaluationProgress = councilEvaluations?.progress
  const showCouncilEvaluationUi =
    isPendingReview && Boolean(viewedCouncilId) && canAccessCouncilEvaluations
  const canShowFinalizeActions =
    canFinalizeCouncil &&
    Boolean(evaluationProgress?.isComplete) &&
    isPendingReview &&
    Boolean(viewedCouncilId)

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
          {canShortcutCreateCouncil ? (
            <Button variant="outline" onClick={() => setCreateCouncilOpen(true)}>
              <Plus className="mr-2 size-4" />
              {t('proposal.createCouncil')}
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

              {!canEditDraft && isPendingReview && canReadCouncil ? (
                <Button variant="outline" onClick={() => setViewCouncilOpen(true)}>
                  {t('proposal.viewCouncil')}
                </Button>
              ) : null}

              {showCouncilEvaluationUi && evaluationProgress ? (
                <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  {t('proposal.evaluationProgress', {
                    submitted: evaluationProgress.submittedCount,
                    required: evaluationProgress.requiredCount,
                    membersComplete: evaluationProgress.membersComplete.length,
                    memberCount: evaluationProgress.memberCount,
                  })}
                </p>
              ) : null}

              {canShowFinalizeActions ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={finalizeMutation.isPending}
                    onClick={() => setFinalizeDialog('APPROVED')}
                  >
                    {t('proposal.finalizeApprove')}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={finalizeMutation.isPending}
                    onClick={() => setFinalizeDialog('REJECTED')}
                  >
                    {t('proposal.finalizeReject')}
                  </Button>
                </div>
              ) : null}

              <div>
                <h4 className="mb-2 text-sm font-medium">{t('proposal.itemsTitle')}</h4>
                {catalogDetail.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('proposal.itemsEmpty')}</p>
                ) : (
                  <DisposalCatalogItemsTable
                    groups={catalogGroups}
                    canEdit={canEditDraft}
                    reasonDrafts={reasonDrafts}
                    onReasonDraftChange={(itemId, reason) =>
                      setReasonDrafts((prev) => ({ ...prev, [itemId]: reason }))
                    }
                    onReasonSave={(itemId, reason) =>
                      saveReasonMutation.mutate({ itemId, reason })
                    }
                    onRemoveItem={(itemId) => removeItemMutation.mutate(itemId)}
                    isSavingReason={saveReasonMutation.isPending}
                    isRemoving={removeItemMutation.isPending}
                    onPreviewDocument={setDocumentPreview}
                    councilEvaluation={
                      showCouncilEvaluationUi && currentUser?.id
                        ? {
                            enabled: true,
                            isMember: isCouncilMember,
                            canViewAllNotes: isCouncilMember || canFinalizeCouncil,
                            currentUserId: currentUser.id,
                            drafts: evaluationDrafts,
                            evaluationsByItemId,
                            onDraftChange: (itemId, note) =>
                              setEvaluationDrafts((prev) => ({ ...prev, [itemId]: note })),
                            onSave: (itemId) => {
                              const note = evaluationDrafts[itemId]?.trim() ?? ''
                              if (!note || !viewedCouncilId) return
                              saveEvaluationMutation.mutate({ itemId, note })
                            },
                            isSaving: saveEvaluationMutation.isPending,
                          }
                        : undefined
                    }
                  />
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

      <AlertDialog
        open={finalizeDialog !== null}
        onOpenChange={(open) => {
          if (!open) setFinalizeDialog(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {finalizeDialog === 'APPROVED'
                ? t('proposal.finalizeApproveTitle')
                : t('proposal.finalizeRejectTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {finalizeDialog === 'APPROVED'
                ? t('proposal.finalizeApproveDescription', {
                    name: catalogDetail?.catalog.name ?? '',
                  })
                : t('proposal.finalizeRejectDescription', {
                    name: catalogDetail?.catalog.name ?? '',
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finalizeMutation.isPending}>
              {t('proposal.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={finalizeMutation.isPending || finalizeDialog === null}
              onClick={(event) => {
                event.preventDefault()
                if (!finalizeDialog) return
                finalizeMutation.mutate(finalizeDialog)
              }}
            >
              {finalizeMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {finalizeDialog === 'APPROVED'
                ? t('proposal.finalizeApprove')
                : t('proposal.finalizeReject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DisposalCouncilCreateDialog
        open={createCouncilOpen}
        onOpenChange={setCreateCouncilOpen}
        initialCatalogId={selectedCatalogId}
        initialCatalogLabel={catalogDetail?.catalog.name}
        lockCatalogSelect
        onCreated={(councilId) => {
          void navigate({
            search: (prev) => ({
              ...prev,
              disposalCouncilId: councilId,
            }),
          })
          void queryClient.invalidateQueries({
            queryKey: disposalCatalogsQueryKeyPrefix,
          })
          if (selectedCatalogId) {
            void queryClient.invalidateQueries({
              queryKey: ['archive-disposal', 'catalog', selectedCatalogId],
            })
          }
        }}
      />

      <DisposalCouncilViewDialog
        open={viewCouncilOpen}
        onOpenChange={setViewCouncilOpen}
        councilId={viewedCouncilId}
      />

      <DisposalDocumentPreviewPanel
        target={documentPreview}
        onClose={() => setDocumentPreview(null)}
      />
    </div>
  )
}
