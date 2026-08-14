import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Loader2, Plus, Save, Send, Trash2, ListFilter } from 'lucide-react'
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
import { DisposalAppraisalExportPanel } from '@/features/archive-disposal/components/DisposalAppraisalExportPanel'
import { DisposalCouncilCreateDialog } from '@/features/archive-disposal-council/components/DisposalCouncilCreateDialog'
import { DisposalCouncilViewDialog } from '@/features/archive-disposal-council/components/DisposalCouncilViewDialog'
import {
  chairDecideDisposalCouncilItem,
  finalizeDisposalCouncilReview,
  getDisposalCouncilDecisionDocuments,
  publishDisposalCouncilDecision,
  uploadDisposalCouncilSignedMinutes,
  upsertDisposalCouncilItemEvaluation,
} from '@/features/archive-disposal-council/api/disposalCouncilClient'
import type { DisposalCouncilEvaluationDecisionT } from '@/features/archive-disposal-council/types'
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
import type {
  DisposalCatalogDetailT,
  DisposalProposalCatalogStatusT,
} from '@/features/archive-disposal/types'
import { profileQueryOptions } from '@/features/auth/queries'
import { DEFAULT_LIST_PAGE_LIMIT, LIST_PAGE_SIZE_OPTIONS } from '@/lib/schemas/list-page-search'
import { translateError } from '@/lib/utils/translate-error'

const routeApi = getRouteApi('/app/archive-warehouse/')

function isCatalogStatusKey(
  status: string,
): status is DisposalProposalCatalogStatusT {
  return (
    status === 'DRAFT' ||
    status === 'PENDING_SUBMIT' ||
    status === 'SUBMITTED' ||
    status === 'AWAITING_FEEDBACK' ||
    status === 'APPROVED' ||
    status === 'REJECTED' ||
    status === 'DESTROYED'
  )
}

export function ArchiveDisposalProposalPage() {
  const { t } = useTranslation('archive-disposal')
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const queryClient = useQueryClient()
  const {
    canCreateDisposal,
    canUpdateDisposal,
    canSubmitDisposal,
    canReadDisposal,
  } = useArchiveDisposalAccess()
  const {
    canCreateCouncil,
    canReadCouncil,
    canFinalizeCouncil,
    canPublishCouncil,
    canChairDecideCouncil,
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
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [createCouncilOpen, setCreateCouncilOpen] = useState(false)
  const [viewCouncilOpen, setViewCouncilOpen] = useState(false)
  const [appraisalExportOpen, setAppraisalExportOpen] = useState(false)
  const [evaluationDrafts, setEvaluationDrafts] = useState<
    Record<
      string,
      {
        decision: DisposalCouncilEvaluationDecisionT | null
        reason: string
        changeReason: string
      }
    >
  >({})
  const [chairDialogItemId, setChairDialogItemId] = useState<string | null>(null)
  const [chairDecision, setChairDecision] =
    useState<DisposalCouncilEvaluationDecisionT>('DESTROY')
  const [chairReason, setChairReason] = useState('')
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
  const isAwaitingFeedback = catalogDetail?.catalog.status === 'AWAITING_FEEDBACK'

  const { data: councilsForCatalog } = useQuery({
    ...disposalCouncilsQueryOptions({
      catalogId: selectedCatalogId ?? undefined,
      page: 1,
      limit: 1,
    }),
    enabled:
      Boolean(selectedCatalogId) &&
      (viewCouncilOpen || isPendingReview || isAwaitingFeedback) &&
      (canReadCouncil || isPendingReview || isAwaitingFeedback),
  })
  const councilForSelectedCatalog = councilsForCatalog?.items[0]?.id ?? null
  const viewedCouncilId = useMemo(() => {
    const urlCouncilId = search.disposalCouncilId
    if (!urlCouncilId) return councilForSelectedCatalog
    // Chưa load HĐH của catalog hiện tại — không tin disposalCouncilId trên URL (có thể là HĐH catalog khác).
    if (!councilsForCatalog) return councilForSelectedCatalog
    const urlBelongsToCatalog = councilsForCatalog.items.some(
      (council) => council.id === urlCouncilId,
    )
    return urlBelongsToCatalog ? urlCouncilId : councilForSelectedCatalog
  }, [search.disposalCouncilId, councilsForCatalog, councilForSelectedCatalog])

  const { data: councilDetail } = useQuery({
    ...disposalCouncilDetailQueryOptions(viewedCouncilId),
    enabled: Boolean(viewedCouncilId) && (isPendingReview || isAwaitingFeedback),
  })

  const isCouncilMember = useMemo(() => {
    if (!currentUser?.id || !councilDetail?.members) return false
    return councilDetail.members.some((member) => member.userId === currentUser.id)
  }, [councilDetail?.members, currentUser?.id])

  const isCouncilChair = useMemo(() => {
    if (!currentUser?.id || !councilDetail?.members) return false
    return councilDetail.members.some(
      (member) => member.userId === currentUser.id && member.positionRole === 'CHAIR',
    )
  }, [councilDetail?.members, currentUser?.id])

  const isCatalogCreator = useMemo(() => {
    if (!currentUser?.id) return false
    const creatorId =
      catalogDetail?.catalog.createdBy ??
      councilDetail?.council.catalogCreatedBy
    return Boolean(creatorId && creatorId === currentUser.id)
  }, [
    catalogDetail?.catalog.createdBy,
    councilDetail?.council.catalogCreatedBy,
    currentUser?.id,
  ])

  const canAccessCouncilEvaluations =
    (isPendingReview || isAwaitingFeedback) &&
    Boolean(viewedCouncilId) &&
    (isCouncilMember || canFinalizeCouncil || canReadCouncil)

  const { data: councilEvaluations } = useQuery({
    ...disposalCouncilEvaluationsQueryOptions(viewedCouncilId),
    enabled: canAccessCouncilEvaluations,
  })

  const evaluationsByItemId = useMemo(() => {
    const map: Record<
      string,
      Array<{
        userId: string
        userName: string
        note: string
        decision: DisposalCouncilEvaluationDecisionT | null
      }>
    > = {}
    for (const row of councilEvaluations?.items ?? []) {
      if (!map[row.itemId]) map[row.itemId] = []
      map[row.itemId]!.push({
        userId: row.userId,
        userName: row.userName,
        note: row.note,
        decision: row.decision,
      })
    }
    return map
  }, [councilEvaluations?.items])

  const outcomesByItemId = useMemo(() => {
    const map: Record<
      string,
      {
        concludedDecision: DisposalCouncilEvaluationDecisionT | null
        needsChairDecision: boolean
        hasDissent: boolean
        destroyVoteCount: number
        keepVoteCount: number
      }
    > = {}
    for (const row of councilEvaluations?.outcomes ?? []) {
      map[row.itemId] = {
        concludedDecision: row.concludedDecision,
        needsChairDecision: row.needsChairDecision,
        hasDissent: row.hasDissent,
        destroyVoteCount: row.destroyVoteCount,
        keepVoteCount: row.keepVoteCount,
      }
    }
    return map
  }, [councilEvaluations?.outcomes])

  const hasPendingChairDecisions = useMemo(
    () =>
      (councilEvaluations?.outcomes ?? []).some(
        (outcome) => outcome.needsChairDecision,
      ),
    [councilEvaluations?.outcomes],
  )

  useEffect(() => {
    if (!councilEvaluations?.items || !currentUser?.id) return
    setEvaluationDrafts((prev) => {
      const next = { ...prev }
      for (const row of councilEvaluations.items) {
        if (row.userId === currentUser.id) {
          next[row.itemId] = {
            decision: row.decision,
            reason: row.note,
            changeReason: prev[row.itemId]?.changeReason ?? '',
          }
        }
      }
      return next
    })
  }, [councilEvaluations?.items, currentUser?.id])

  const { data: decisionDocuments, refetch: refetchDecisionDocuments } = useQuery({
    queryKey: ['archive-disposal', 'council-decision-docs', viewedCouncilId],
    queryFn: () => getDisposalCouncilDecisionDocuments(viewedCouncilId!),
    enabled: Boolean(viewedCouncilId) && (isPendingReview || isAwaitingFeedback) && canAccessCouncilEvaluations,
  })

  useEffect(() => {
    if (
      search.disposalCouncilId &&
      isPendingReview &&
      viewedCouncilId === search.disposalCouncilId
    ) {
      setViewCouncilOpen(true)
    }
  }, [search.disposalCouncilId, isPendingReview, viewedCouncilId])

  useEffect(() => {
    if (!selectedCatalogId || councilsForCatalog === undefined) return
    const urlCouncilId = search.disposalCouncilId
    if (!urlCouncilId) return
    const urlBelongsToCatalog = councilsForCatalog.items.some(
      (council) => council.id === urlCouncilId,
    )
    if (!urlBelongsToCatalog) {
      void navigate({
        search: (prev) => ({
          ...prev,
          disposalCouncilId: councilForSelectedCatalog ?? undefined,
        }),
        replace: true,
      })
    }
  }, [
    selectedCatalogId,
    councilsForCatalog,
    councilForSelectedCatalog,
    search.disposalCouncilId,
    navigate,
  ])

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
          disposalCouncilId: undefined,
        }),
      })
    },
    onError: (error) => toast.error(translateError(error)),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const catalogId = selectedCatalogId!
      const items = catalogDetail?.items ?? []
      const updatedCatalog = await updateDisposalCatalog(catalogId, {
        name: formName,
        catalogDate: formDate,
        notes: formNotes,
      })
      if (items.length === 0) return updatedCatalog
      await Promise.all(
        items.map((item) =>
          updateDisposalCatalogItem(catalogId, item.id, {
            reason: (reasonDrafts[item.id] ?? item.reason).trim(),
          }),
        ),
      )
      return updatedCatalog
    },
    onSuccess: (updatedCatalog) => {
      toast.success(t('proposal.saveSuccess'))
      if (updatedCatalog && selectedCatalogId) {
        queryClient.setQueryData<DisposalCatalogDetailT>(
          ['archive-disposal', 'catalog', selectedCatalogId],
          (old) =>
            old
              ? {
                  ...old,
                  catalog: { ...old.catalog, ...updatedCatalog },
                }
              : old,
        )
      }
      void queryClient.invalidateQueries({ queryKey: disposalCatalogsQueryKeyPrefix })
      void queryClient.invalidateQueries({
        queryKey: ['archive-disposal', 'catalog', selectedCatalogId],
      })
    },
    onError: (error) => toast.error(translateError(error)),
  })

  function handleSaveCatalog() {
    const items = catalogDetail?.items ?? []
    const missingReasonCount = items.filter(
      (item) => !(reasonDrafts[item.id]?.trim() ?? ''),
    ).length
    if (missingReasonCount > 0) {
      toast.error(
        t('proposal.missingReasonBeforeSave', { count: missingReasonCount }),
      )
      return
    }
    saveMutation.mutate()
  }

  function handleRequestSubmit() {
    const items = catalogDetail?.items ?? []
    if (items.length === 0) {
      toast.error(t('proposal.itemsEmpty'))
      return
    }
    const missingReasonCount = items.filter(
      (item) => !(reasonDrafts[item.id]?.trim() ?? ''),
    ).length
    if (missingReasonCount > 0) {
      toast.error(
        t('proposal.missingReasonBeforeSave', { count: missingReasonCount }),
      )
      return
    }
    setSubmitConfirmOpen(true)
  }

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
          disposalCouncilId: undefined,
          page: 1,
        }),
      })
    },
    onError: (error) => toast.error(translateError(error)),
  })

  const saveEvaluationMutation = useMutation({
    mutationFn: ({
      itemId,
      decision,
      reason,
      changeReason,
    }: {
      itemId: string
      decision: DisposalCouncilEvaluationDecisionT
      reason: string
      changeReason?: string
    }) =>
      upsertDisposalCouncilItemEvaluation(viewedCouncilId!, itemId, {
        decision,
        reason,
        changeReason,
      }),
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

  const chairDecideMutation = useMutation({
    mutationFn: ({
      itemId,
      decision,
      reason,
    }: {
      itemId: string
      decision: DisposalCouncilEvaluationDecisionT
      reason: string
    }) => chairDecideDisposalCouncilItem(viewedCouncilId!, itemId, { decision, reason }),
    onSuccess: () => {
      toast.success(t('proposal.chairDecideSuccess'))
      setChairDialogItemId(null)
      setChairReason('')
      if (viewedCouncilId) {
        void queryClient.invalidateQueries({
          queryKey: ['archive-disposal', 'council-evaluations', viewedCouncilId],
        })
      }
    },
    onError: (error) => toast.error(translateError(error)),
  })

  const publishDecisionMutation = useMutation({
    mutationFn: () => publishDisposalCouncilDecision(viewedCouncilId!),
    onSuccess: () => {
      toast.success(t('proposal.publishDecisionSuccess'))
      void refetchDecisionDocuments()
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

  const uploadSignedMinutesMutation = useMutation({
    mutationFn: (file: File) =>
      uploadDisposalCouncilSignedMinutes(viewedCouncilId!, file),
    onSuccess: () => {
      toast.success(t('proposal.signedMinutesUploadSuccess'))
      void refetchDecisionDocuments()
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
  const catalogStatus = catalogDetail?.catalog.status
  const catalogStatusDescription =
    catalogStatus && isCatalogStatusKey(catalogStatus)
      ? t(`proposal.statusDescription.${catalogStatus}`)
      : null
  const councilReviewEnabled = disposalSettings?.councilReviewEnabled ?? true
  const canEditDraft = isDraft && canUpdateDisposal
  const canPickFromExpiryList =
    canEditDraft && Boolean(selectedCatalogId)
  const canShortcutCreateCouncil =
    councilReviewEnabled && isSubmitted && canCreateCouncil
  const totalPages = catalogList?.totalPages ?? 1
  const evaluationProgress = councilEvaluations?.progress
  const showCouncilEvaluationUi =
    isPendingReview && Boolean(viewedCouncilId) && canAccessCouncilEvaluations
  const directorApprovalReady = Boolean(
    decisionDocuments?.decisionPublishedAt && decisionDocuments?.hasSignedMinutes,
  )

  const canShowFinalizeActions =
    canFinalizeCouncil &&
    Boolean(evaluationProgress?.isComplete) &&
    directorApprovalReady &&
    isPendingReview &&
    Boolean(viewedCouncilId)

  const showFinalizeBlockedHint =
    canFinalizeCouncil &&
    Boolean(evaluationProgress?.isComplete) &&
    isPendingReview &&
    Boolean(viewedCouncilId) &&
    !directorApprovalReady

  const evaluationsLocked = Boolean(
    evaluationProgress?.evaluationsLocked ?? councilDetail?.council.decisionPublishedAt,
  )

  const canPublishDecision =
    canPublishCouncil || (isCatalogCreator && canSubmitDisposal)

  const canShowAppendixExport =
    canReadDisposal &&
    Boolean(selectedCatalogId) &&
    (catalogDetail?.items.length ?? 0) > 0 &&
    (isPendingReview || isAwaitingFeedback) &&
    Boolean(viewedCouncilId) &&
    Boolean(evaluationProgress?.isComplete) &&
    !hasPendingChairDecisions

  const canShowPublishActions =
    canPublishDecision &&
    isCatalogCreator &&
    Boolean(evaluationProgress?.isComplete) &&
    !hasPendingChairDecisions &&
    !evaluationsLocked &&
    isPendingReview &&
    Boolean(viewedCouncilId)

  const showPublishBlockedHint =
    canShowAppendixExport &&
    !canShowPublishActions &&
    !evaluationsLocked

  const publishBlockedMessage = !isCatalogCreator
    ? t('proposal.publishBlockedNotCreator')
    : !canPublishDecision
      ? t('proposal.publishBlockedMissingPermission')
      : null

  const canShowViewCouncil =
    Boolean(selectedCatalogId) &&
    !canEditDraft &&
    (isPendingReview || isAwaitingFeedback) &&
    canReadCouncil &&
    Boolean(viewedCouncilId)

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-end gap-2">
          {canPickFromExpiryList ? (
            <>
            <Button
              variant="outline"
              onClick={() => {
                if (!selectedCatalogId) return
                void navigate({
                  search: (prev) => ({
                    ...prev,
                    tab: 'expiryReview',
                    disposalView: 'list',
                    disposalCatalogId: selectedCatalogId,
                    disposalAppendCatalogId: selectedCatalogId,
                    searchFondId: catalogDetail?.catalogFondId ?? undefined,
                    pickerMode: undefined,
                    browseView: undefined,
                    page: 1,
                  }),
                })
              }}
            >
              <ListFilter className="mr-2 size-4" />
              {t('proposal.addFromExpiryList')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!selectedCatalogId) return
                void navigate({
                  search: (prev) => ({
                    ...prev,
                    tab: 'dossiers',
                    browseView: 'fonds',
                    pickerMode: true,
                    disposalCatalogId: selectedCatalogId,
                    searchFondId: catalogDetail?.catalogFondId ?? undefined,
                    page: 1,
                  }),
                })
              }}
            >
              {t('proposal.addFromWarehouse')}
            </Button>
            </>
          ) : null}
          {canShowViewCouncil ? (
            <Button variant="outline" onClick={() => setViewCouncilOpen(true)}>
              {t('proposal.viewCouncil')}
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
                    setViewCouncilOpen(false)
                    void navigate({
                      search: (prev) => ({
                        ...prev,
                        disposalCatalogId: catalog.id,
                        disposalCouncilId: undefined,
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
              <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
                <Badge variant="secondary">
                  {catalogStatus && isCatalogStatusKey(catalogStatus)
                    ? t(`proposal.status.${catalogStatus}`)
                    : catalogStatus}
                </Badge>
                {catalogStatusDescription ? (
                  <p className="text-sm text-muted-foreground">
                    {catalogStatusDescription}
                  </p>
                ) : null}
              </div>
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
                    type="button"
                    variant="outline"
                    disabled={saveMutation.isPending}
                    onClick={handleSaveCatalog}
                  >
                    <Save className="mr-2 size-4" />
                    {t('proposal.save')}
                  </Button>
                  {canSubmitDisposal ? (
                    <Button
                      type="button"
                      disabled={submitMutation.isPending}
                      onClick={handleRequestSubmit}
                    >
                      <Send className="mr-2 size-4" />
                      {t('proposal.submit')}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={deleteCatalogMutation.isPending}
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="mr-2 size-4" />
                    {t('proposal.delete')}
                  </Button>
                </div>
              ) : null}

              {canShowAppendixExport ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAppraisalExportOpen(true)}
                >
                  {t('appraisalExport.openPanel')}
                </Button>
              ) : null}

              {showCouncilEvaluationUi && evaluationProgress ? (
                <div className="space-y-2">
                  <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    {t('proposal.evaluationProgress', {
                      submitted: evaluationProgress.submittedCount,
                      required: evaluationProgress.requiredCount,
                      membersComplete: evaluationProgress.membersComplete.length,
                      memberCount: evaluationProgress.participatingMemberCount,
                    })}
                    {evaluationsLocked ? ` — ${t('proposal.evaluationsLocked')}` : null}
                  </p>
                  {evaluationProgress.missingMembers.length > 0 ? (
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      {t('proposal.missingEvaluations')}:{' '}
                      {evaluationProgress.missingMembers
                        .map(
                          (member) =>
                            `${member.fullName} (${member.missingUnitCount})`,
                        )
                        .join(', ')}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {showPublishBlockedHint && publishBlockedMessage ? (
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  {publishBlockedMessage}
                </p>
              ) : null}

              {canShowPublishActions ? (
                <Button
                  disabled={publishDecisionMutation.isPending}
                  onClick={() => publishDecisionMutation.mutate()}
                >
                  {t('proposal.publishDecision')}
                </Button>
              ) : null}

              {canPublishCouncil &&
              isCatalogCreator &&
              decisionDocuments?.decisionPublishedAt ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor="signed-minutes-upload" className="text-sm">
                    {decisionDocuments.hasSignedMinutes
                      ? t('proposal.signedMinutesPresent')
                      : t('proposal.uploadSignedMinutes')}
                  </Label>
                  <Input
                    id="signed-minutes-upload"
                    type="file"
                    accept="application/pdf"
                    className="max-w-xs"
                    disabled={uploadSignedMinutesMutation.isPending}
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) uploadSignedMinutesMutation.mutate(file)
                      event.target.value = ''
                    }}
                  />
                  {decisionDocuments.signedMinutesDocumentUrl ? (
                    <Button variant="link" asChild className="h-auto p-0">
                      <a
                        href={decisionDocuments.signedMinutesDocumentUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t('proposal.viewSignedMinutes')}
                      </a>
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {showFinalizeBlockedHint ? (
                <p className="text-sm text-muted-foreground">
                  {!decisionDocuments?.decisionPublishedAt
                    ? t('proposal.finalizeAwaitPublish')
                    : t('proposal.finalizeAwaitDirectorApproval')}
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
                    onReasonSave={(itemId, reason) => {
                      if (!reason.trim()) {
                        toast.error(t('proposal.reasonRequired'))
                        const saved =
                          catalogDetail?.items.find((item) => item.id === itemId)
                            ?.reason ?? ''
                        setReasonDrafts((prev) => ({ ...prev, [itemId]: saved }))
                        return
                      }
                      saveReasonMutation.mutate({ itemId, reason })
                    }}
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
                            canChairDecide:
                              canChairDecideCouncil && isCouncilChair && !evaluationsLocked,
                            evaluationsLocked,
                            currentUserId: currentUser.id,
                            drafts: evaluationDrafts,
                            evaluationsByItemId,
                            outcomesByItemId,
                            onDraftChange: (itemId, patch) =>
                              setEvaluationDrafts((prev) => ({
                                ...prev,
                                [itemId]: {
                                  decision: null,
                                  reason: '',
                                  changeReason: '',
                                  ...prev[itemId],
                                  ...patch,
                                },
                              })),
                            onSave: (itemId) => {
                              const draft = evaluationDrafts[itemId]
                              if (!draft?.decision || !viewedCouncilId) return
                              const reason = draft.reason.trim()
                              if (!reason) return
                              saveEvaluationMutation.mutate({
                                itemId,
                                decision: draft.decision,
                                reason,
                                changeReason: draft.changeReason.trim() || undefined,
                              })
                            },
                            onChairDecide: (itemId) => setChairDialogItemId(itemId),
                            isSaving:
                              saveEvaluationMutation.isPending ||
                              chairDecideMutation.isPending,
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

      <AlertDialog open={submitConfirmOpen} onOpenChange={setSubmitConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('proposal.submitConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('proposal.submitConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitMutation.isPending}>
              {t('proposal.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={submitMutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                submitMutation.mutate(undefined, {
                  onSettled: () => setSubmitConfirmOpen(false),
                })
              }}
            >
              {submitMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {t('proposal.submit')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <AlertDialog
        open={chairDialogItemId !== null}
        onOpenChange={(open) => {
          if (!open) setChairDialogItemId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('proposal.chairDecideTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('proposal.chairDecideDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="chair-decision"
                  checked={chairDecision === 'DESTROY'}
                  onChange={() => setChairDecision('DESTROY')}
                />
                {t('proposal.evaluationDecisionDestroy')}
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="chair-decision"
                  checked={chairDecision === 'KEEP'}
                  onChange={() => setChairDecision('KEEP')}
                />
                {t('proposal.evaluationDecisionKeep')}
              </label>
            </div>
            <Textarea
              value={chairReason}
              onChange={(event) => setChairReason(event.target.value)}
              placeholder={t('proposal.chairReasonPlaceholder')}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={chairDecideMutation.isPending}>
              {t('proposal.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={
                chairDecideMutation.isPending ||
                !chairDialogItemId ||
                chairReason.trim().length === 0
              }
              onClick={(event) => {
                event.preventDefault()
                if (!chairDialogItemId) return
                chairDecideMutation.mutate({
                  itemId: chairDialogItemId,
                  decision: chairDecision,
                  reason: chairReason.trim(),
                })
              }}
            >
              {chairDecideMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {t('proposal.chairDecideConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedCatalogId ? (
        <DisposalAppraisalExportPanel
          open={appraisalExportOpen}
          onOpenChange={setAppraisalExportOpen}
          catalogId={selectedCatalogId}
          canEditPl3={isPendingReview}
        />
      ) : null}

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
