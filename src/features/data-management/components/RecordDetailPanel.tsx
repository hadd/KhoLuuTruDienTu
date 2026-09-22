import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, FileDown, Loader2, PenLine, Save } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useScrollSyncHighlight } from '@/features/data-management/hooks/useScrollSyncHighlight'

import type {
  PdfBboxRevealRegion,
  PdfFieldHighlight,
} from '@/components/common/PdfViewer'
import { PdfViewer } from '@/components/common/PdfViewer'
import { PdfViewerToolbar } from '@/components/common/PdfViewerToolbar'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EditorErrorReportAlertBanner } from '@/features/data-management/components/EditorErrorReportAlertBanner'
import { EditorErrorReportDialog } from '@/features/data-management/components/EditorErrorReportDialog'
import { EditorErrorReportReviewDialog } from '@/features/data-management/components/EditorErrorReportReviewDialog'
import { ExportChoiceDialog } from '@/features/data-management/components/ExportChoiceDialog'
import { QcInlineRejectBar } from '@/features/data-management/components/QcInlineRejectBar'
import { RecordMetadataGroupCard } from '@/features/data-management/components/RecordMetadataGroupCard'
import { RecordMetadataEditHistorySection } from '@/features/data-management/components/RecordMetadataEditHistorySection'
import { RevertMetadataHistoryDialog } from '@/features/data-management/components/RevertMetadataHistoryDialog'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { profileQueryOptions } from '@/features/auth/queries'
import { isNodeChildrenCached } from '@/features/data-management/api/dataManagementClient'
import { getPermissionsByRole } from '@/features/data-management/config/roleConfig'
import { useEditorErrorReports } from '@/features/data-management/hooks/useEditorErrorReports'
import { useQcInlineReject } from '@/features/data-management/hooks/useQcInlineReject'
import { useRoleAccess } from '@/features/permissions/hooks/useRoleAccess'
import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'
import {
  canExportAnyStatusPermission,
  canExportDossiersPermission,
} from '@/features/data-management/lib/dossierExportAccess'
import { buildPdfFieldHighlight } from '@/features/data-management/lib/bboxCoords'
import { resolveCurrentUserCheckerLevel } from '@/features/data-management/lib/checkerAssignmentHelpers'
import {
  canEditorSubmitMetadata,
  canExportDossierMetadata,
  canManageDossierMetadata,
  canQcSubmitAtAssignedLevel,
  getCheckerLevelForDossierStatus,
  isDossierMetadataLocked,
} from '@/features/data-management/lib/dossierStatusHelpers'
import {
  canShowEditorErrorReportsForDossier,
  getRejectedIssueReportFromClaim,
} from '@/features/data-management/lib/editorErrorReportHelpers'
import type {
  ExportContext,
  ExportMode,
  ExportOptions,
} from '@/features/data-management/lib/exportHelpers'
import { runExport } from '@/features/data-management/lib/exportHelpers'
import { mapMetadataHistoryToBatches } from '@/features/data-management/lib/metadataEditHistoryMapper'
import {
  buildDossierRecordContent,
  buildRejectFieldKey,
  buildRejectedFieldsSummaryByDocument,
  findAllDocumentsForMetadataGroup,
  findAllMetadataGroupIndicesForDocument,
  findDocumentForMetadataGroup,
  findMetadataGroupIndexForDocument,
  handleMetadataFieldNavigationKeyDown,
  isPdfDocumentRef,
  mergeMetadataFieldChanges,
  resolveDocumentOcrPdfUrl,
  resolveMetadataGroupRejectScope,
  resolveRecordPanelMetadata,
  serializeDossierMetadataForStorage,
} from '@/features/data-management/lib/metadataHelpers'
import {
  countVisibleMetadataGroups,
  getTaiLieuDocumentDisplayTitle,
  partitionMetadataGroupsForDisplay,
  resolveDefaultMetadataGroupIndex,
  type MetadataGroupEntry,
} from '@/features/data-management/lib/metadataLayout'
import {
  findHoSoFondFieldValue,
  hasHoSoFondField,
  isFondFieldName,
  propagateHoSoFondToDocuments,
  syncFondValueAcrossMetadata,
} from '@/features/data-management/lib/metadataNormalize'
import { resolveEditorPdfMaskEnabled } from '@/features/data-management/lib/pdfMaskPolicy'
import {
  dossierMetadataHistoryQueryOptions,
  dossierWorkflowAssignmentsQueryOptions,
  useRestoreDossierMetadataHistoryMutation,
  useSaveDossierMetadataMutation,
} from '@/features/data-management/queries'
import { translateError } from '@/lib/utils/translate-error'
import type {
  DataDocumentFieldT,
  DataDossierMetadataT,
  DataDossierStatus,
  DataMetadataEditBatchT,
  DataMetadataEditFieldChangeT,
  DataMetadataGroupT,
  DataMetadataHistoryFileRefT,
  DataTreeNodeT,
} from '@/features/data-management/types'
import {
  editorDraftDossiersQueryKey,
  useSubmitEditorDraftFinalSaveItemsMutation,
} from '@/features/editor-dossiers/queries'
import { cn } from '@/lib/utils/cn'
import { DigitalSignDialog } from '@/features/digital-sign/components/DigitalSignDialog'
import {
  ensureSignAgentReady,
  SIGN_AGENT_DOWNLOAD_URL,
} from '@/features/digital-sign/lib/ensureSignAgentReady'

function fieldToHighlight(
  field: DataDocumentFieldT,
  groupFields: Array<DataDocumentFieldT>,
): PdfFieldHighlight | null {
  return buildPdfFieldHighlight(field, groupFields)
}

export type EditorMetadataSaveMode =
  | 'draft'
  | 'draft_advance'
  | 'final'
  | 'error_report'

const AUTO_DRAFT_SAVE_DELAY_MS = 3_000

export function RecordDetailPanel({
  node,
  role,
  dossierId,
  dossierStatus,
  isEditorDraftView = false,
  focusDocumentId,
  focusGroupIndex,
  focusFieldKey,
  onFocusDocument,
  onMarkDocumentsComplete,
  onWorkflowComplete,
  onDigitalSignCompleted,
}: {
  node: DataTreeNodeT
  role: string
  dossierId: string
  dossierStatus?: DataDossierStatus
  isEditorDraftView?: boolean
  focusDocumentId?: string
  focusGroupIndex?: number
  focusFieldKey?: string
  onFocusDocument?: (
    documentId: string | undefined,
    groupIndex: number,
    fieldKey?: string,
  ) => void
  onMarkDocumentsComplete?: (documentIds: Array<string>) => void
  onWorkflowComplete?: (
    dossierId: string,
    mode?: EditorMetadataSaveMode,
  ) => void | Promise<void>
  /** Ký số xong: patch riêng nội dung hồ sơ này (nhanh, không mất nhánh cây
   * đang mở). Nếu không truyền, fallback về onWorkflowComplete (reload toàn
   * cây — chậm hơn và có thể không cập nhật badge "Đã ký số" ngay). */
  onDigitalSignCompleted?: (dossierId: string) => void
}) {
  const { t } = useTranslation('data-management')
  const queryClient = useQueryClient()
  const managementRole = role as DataManagementRole
  const permissions = getPermissionsByRole(managementRole)
  const isEditorRole = managementRole === 'editor'
  const { data: currentUser } = useQuery(profileQueryOptions)
  const workflowQuery = useQuery({
    ...dossierWorkflowAssignmentsQueryOptions(dossierId),
    enabled: Boolean(dossierId.trim()),
  })
  const isEditorDraftDossier =
    isEditorDraftView ||
    node.assignmentStatus === 'DRAFT' ||
    dossierStatus === 'ENTRY_DRAFT'
  const qcRejectFieldKeys = useMemo(
    () => new Set(node.rejectFields ?? []),
    [node.id, node.rejectFields],
  )
  const [isHandlingSave, setIsHandlingSave] = useState(false)
  const [dismissedRejectFieldKeys, setDismissedRejectFieldKeys] = useState<
    Set<string>
  >(() => new Set())
  const { permissions: userPermissions } = useRoleAccess()
  const canDirectApprove = isPermissionGranted(
    userPermissions,
    'dossiers.direct_approve',
    'dossiers',
  )
  const canSignDossiers = isPermissionGranted(
    userPermissions,
    'dossiers.sign',
    'dossiers',
  )
  const effectiveDossierStatus = dossierStatus ?? node.dossierStatus
  const isDossierUnlocked =
    !isDossierMetadataLocked(effectiveDossierStatus) &&
    effectiveDossierStatus !== 'PENDING_ARCHIVE' &&
    effectiveDossierStatus !== 'ARCHIVED'
  const currentQcStepLevel = getCheckerLevelForDossierStatus(
    effectiveDossierStatus,
  )
  const currentUserCheckerLevel = resolveCurrentUserCheckerLevel({
    dossierStatus: effectiveDossierStatus,
    userId: currentUser?.id,
    assignedCheckerLevel: node.assignedCheckerLevel,
    assignments: workflowQuery.data?.assignments,
  })
  const canActAsChecker =
    (canDirectApprove && isDossierUnlocked) ||
    canQcSubmitAtAssignedLevel({
      dossierStatus: effectiveDossierStatus,
      assignedCheckerLevel: currentUserCheckerLevel ?? undefined,
    })
  const canManage = canManageDossierMetadata({
    role: managementRole,
    dossierStatus,
    baseCanManage: permissions.canEditFileMetadataFields,
    canDirectApprove,
  })
  const isInQcStep = currentQcStepLevel != null
  const canShowSubmitButton =
    isDossierUnlocked &&
    (canDirectApprove ||
      (isInQcStep
        ? canActAsChecker
        : canManage &&
          (managementRole !== 'editor' ||
            canEditorSubmitMetadata({
              assignmentStatus: node.assignmentStatus,
              dossierStatus: effectiveDossierStatus,
            })) &&
          (managementRole !== 'qc' || canActAsChecker)))
  const canExportDossiers = canExportDossiersPermission(userPermissions)
  const canExportAnyStatus = canExportAnyStatusPermission(userPermissions)
  const canExport =
    canExportDossiers &&
    canExportDossierMetadata(dossierStatus ?? node.dossierStatus, {
      bypassStatus: canExportAnyStatus,
    })
  const canDigitalSign =
    canSignDossiers &&
    permissions.canDigitalSign &&
    (effectiveDossierStatus === 'APPROVED' ||
      effectiveDossierStatus === 'ARCHIVE_REJECTED')
  const saveMutation = useSaveDossierMetadataMutation(managementRole)
  const finalSaveMutation = useSubmitEditorDraftFinalSaveItemsMutation()
  const restoreHistoryMutation = useRestoreDossierMetadataHistoryMutation()
  const isQcRole = managementRole === 'qc'
  const isActingAsQc = isQcRole || canActAsChecker
  const isManagerRole = managementRole === 'manager'
  const canReviewErrorReports =
    isQcRole || isManagerRole || managementRole === 'admin'
  const editorErrorReports = useEditorErrorReports(managementRole, {
    dossierId,
    dossierName: node.name,
  })
  const [errorReportDialogOpen, setErrorReportDialogOpen] = useState(false)
  const [errorReportReviewOpen, setErrorReportReviewOpen] = useState(false)
  const canShowErrorReportsForDossier = canShowEditorErrorReportsForDossier({
    role: managementRole,
    dossierStatus: effectiveDossierStatus,
    assignedCheckerLevel: currentUserCheckerLevel ?? node.assignedCheckerLevel,
  })
  const pendingErrorReports = canShowErrorReportsForDossier
    ? editorErrorReports.pendingReportsForDossier
    : []
  const errorReportsForReview = canShowErrorReportsForDossier
    ? editorErrorReports.reportsForDossierReview
    : []
  const pendingErrorReportCount = pendingErrorReports.length
  const editorPendingErrorReport =
    editorErrorReports.getEditorPending(dossierId)
  const rejectedFromHook = editorErrorReports.getRejectedForEditor(dossierId)
  const rejectedErrorReport = useMemo(() => {
    if (rejectedFromHook?.rejectNote?.trim()) return rejectedFromHook

    const fromClaim = getRejectedIssueReportFromClaim(
      node.claimIssueReport,
      node.name,
    )
    if (fromClaim?.rejectNote?.trim()) return fromClaim

    return rejectedFromHook ?? fromClaim
  }, [rejectedFromHook, node.claimIssueReport, node.name])
  const canSubmitErrorReport = editorErrorReports.canSubmit(dossierId)
  const isApproveBlockedByErrorReports =
    isActingAsQc && pendingErrorReportCount > 0

  useEffect(() => {
    if (pendingErrorReportCount === 0 && errorReportReviewOpen) {
      setErrorReportReviewOpen(false)
    }
  }, [pendingErrorReportCount, errorReportReviewOpen])
  const canViewEditHistory = permissions.canViewMetadataEditHistory
  const canEditFields = canManage || canActAsChecker

  const { data: fetchedRecordContent, isPending: isRecordContentPending } =
    useQuery({
      queryKey: ['dossier-record-content', dossierId],
      queryFn: () =>
        buildDossierRecordContent(dossierId!, {
          name: node.name,
          dossierId,
          status: effectiveDossierStatus,
          projectCode: node.projectCode,
          fondId: node.fondId,
        }),
      enabled: Boolean(dossierId && !node.dossierMetadata),
      staleTime: 30_000,
    })

  const effectiveNode = useMemo(() => {
    if (node.dossierMetadata || !fetchedRecordContent) return node
    return {
      ...node,
      children:
        fetchedRecordContent.children &&
        fetchedRecordContent.children.length > 0
          ? fetchedRecordContent.children
          : node.children,
      dossierMetadata: fetchedRecordContent.dossierMetadata,
      fullDossierMetadata:
        fetchedRecordContent.fullDossierMetadata ??
        fetchedRecordContent.dossierMetadata,
    }
  }, [node, fetchedRecordContent])

  const metadata = useMemo(
    () => resolveRecordPanelMetadata(effectiveNode, managementRole),
    [
      effectiveNode.dossierMetadata,
      effectiveNode.fullDossierMetadata,
      effectiveNode.allowedFields,
      managementRole,
    ],
  )
  const dossierContentKey = useMemo(() => {
    const groupKey = (metadata?.metadata_groups ?? [])
      .map((group) => `${group.group_code}:${group.fields.length}`)
      .join('|')
    return `${effectiveNode.id}:${metadata?.ho_so_id ?? ''}:${groupKey}`
  }, [effectiveNode.id, metadata?.ho_so_id, metadata?.metadata_groups])
  const [metadataState, setMetadataState] =
    useState<DataDossierMetadataT | null>(() =>
      metadata ? propagateHoSoFondToDocuments(metadata) : null,
    )
  const activeMetadata = metadataState ?? metadata ?? null
  const documents = useMemo(
    () => effectiveNode.children.filter((child) => child.type === 'document'),
    [effectiveNode.children],
  )
  const groups = activeMetadata?.metadata_groups ?? []
  const rejectedFieldSummary = useMemo(() => {
    if (!isEditorRole || !node.rejectFields?.length || !activeMetadata) return []
    return buildRejectedFieldsSummaryByDocument(
      node.rejectFields,
      activeMetadata,
    )
  }, [isEditorRole, node.rejectFields, activeMetadata])
  const metadataDisplayLayout = useMemo(
    () => partitionMetadataGroupsForDisplay(groups),
    [groups],
  )
  const visibleMetadataGroupCount = useMemo(
    () => countVisibleMetadataGroups(metadataDisplayLayout),
    [metadataDisplayLayout],
  )
  const dossierFolderHint = activeMetadata?.ho_so_id?.trim() || node.name
  const ocrPendingEmptyMetadataMessage = useMemo(() => {
    const status = node.dossierStatus
    if (!status || visibleMetadataGroupCount > 0) return null
    if (status === 'OCR_FAILED') {
      return t('recordDetail.ocrFailedMetadata')
    }
    if (status === 'NEW' || status === 'OCR_PROCESSING') {
      return t('recordDetail.ocrPendingMetadata', { status })
    }
    return null
  }, [node.dossierStatus, t, visibleMetadataGroupCount])

  const focusDocument = useMemo(() => {
    if (!focusDocumentId) return null
    return documents.find((document) => document.id === focusDocumentId) ?? null
  }, [documents, focusDocumentId])

  const documentMatchingGroupIndices = useMemo(() => {
    if (!focusDocument || groups.length === 0) return [] as Array<number>
    return findAllMetadataGroupIndicesForDocument(
      groups,
      focusDocument,
      documents,
    )
  }, [focusDocument, groups, documents])

  const initialGroupIndex = useMemo(() => {
    if (focusDocument) {
      return documentMatchingGroupIndices[0] ?? -1
    }
    return resolveDefaultMetadataGroupIndex(groups)
  }, [focusDocument, documentMatchingGroupIndices, groups])

  const [pdfHighlight, setPdfHighlight] = useState<PdfFieldHighlight | null>(
    null,
  )
  const defaultPdfMaskEnabled = useMemo(
    () => isEditorRole && resolveEditorPdfMaskEnabled(node),
    [isEditorRole, node],
  )
  const [isPdfMaskEnabled, setIsPdfMaskEnabled] = useState(
    defaultPdfMaskEnabled,
  )
  const [useOriginalPdfFallback, setUseOriginalPdfFallback] = useState(false)
  const [pdfViewMode, setPdfViewMode] = useState<'source' | 'signed'>('source')
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1)
  const [pdfScrollToPage, setPdfScrollToPage] = useState<number | null>(null)
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null)
  const [pdfZoomScale, setPdfZoomScale] = useState(1)
  const [highlightedFieldKey, setHighlightedFieldKey] = useState<string | null>(
    null,
  )
  const [highlightedChangeId, setHighlightedChangeId] = useState<string | null>(
    null,
  )
  const [detailTab, setDetailTab] = useState<'metadata' | 'editHistory'>(
    'metadata',
  )

  function handleDetailTabChange(value: 'metadata' | 'editHistory') {
    setDetailTab(value)
  }

  // Sync detailTab when focusDocumentId changes from external navigation
  useEffect(() => {
    if (focusDocumentId && detailTab === 'editHistory') {
      setDetailTab('metadata')
    }
  }, [focusDocumentId, detailTab])
  const qcReject = useQcInlineReject({
    dossierId,
    onSuccess: () => void onWorkflowComplete?.(dossierId),
  })
  const [restoringBatchId, setRestoringBatchId] = useState<string | null>(null)
  const [pendingRevertBatch, setPendingRevertBatch] =
    useState<DataMetadataEditBatchT | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [signDialogOpen, setSignDialogOpen] = useState(false)
  const [signInitialFileId, setSignInitialFileId] = useState<string | null>(
    null,
  )
  const [exportingMode, setExportingMode] = useState<ExportMode | null>(null)
  const groupCardRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const fieldInputRefs = useRef<
    Map<string, HTMLInputElement | HTMLTextAreaElement>
  >(new Map())
  const saveButtonRef = useRef<HTMLButtonElement | null>(null)
  const metadataScrollRef = useRef<HTMLDivElement | null>(null)
  const baseMetadataRef = useRef<DataDossierMetadataT | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHandlingSaveRef = useRef(false)
  const metadataStateRef = useRef<DataDossierMetadataT | null>(null)
  const runAutoDraftSaveRef = useRef<() => void>(() => {})
  const nodeRef = useRef(node)
  nodeRef.current = node
  isHandlingSaveRef.current = isHandlingSave
  metadataStateRef.current = metadataState
  const pendingFieldActivationRef = useRef<{
    fieldKey: string
    highlight: PdfFieldHighlight | null
    changeId?: string | null
  } | null>(null)
  const lastAppliedFocusRef = useRef<string | null>(null)
  const lastRestoredFocusFieldKeyRef = useRef<string | null>(null)

  function focusActivationKey(
    documentId?: string,
    groupIndex?: number,
  ): string {
    return `${documentId ?? ''}:${groupIndex ?? ''}`
  }

  const editableFieldKeys = useMemo(() => {
    if (!activeMetadata || !canEditFields) return [] as Array<string>
    const keys: Array<string> = []
    activeMetadata.metadata_groups.forEach((group, groupIndex) => {
      group.fields.forEach((_field, fieldIndex) => {
        keys.push(`${groupIndex}-${fieldIndex}`)
      })
    })
    return keys
  }, [activeMetadata, canEditFields])

  function clearAutoDraftSaveTimer() {
    if (autoSaveTimerRef.current == null) return
    clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = null
  }

  function isMetadataDirtyForAutoSave(): boolean {
    const current = metadataStateRef.current ?? metadata ?? null
    const base = baseMetadataRef.current
    if (!current) return false
    if (!base) return true
    return (
      JSON.stringify(serializeDossierMetadataForStorage(current)) !==
      JSON.stringify(serializeDossierMetadataForStorage(base))
    )
  }

  function scheduleAutoDraftSave() {
    if (!isEditorRole || !canEditFields || !isMetadataDirtyForAutoSave()) {
      clearAutoDraftSaveTimer()
      return
    }
    clearAutoDraftSaveTimer()
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null
      if (isHandlingSaveRef.current) return
      if (!isMetadataDirtyForAutoSave()) return
      runAutoDraftSaveRef.current()
    }, AUTO_DRAFT_SAVE_DELAY_MS)
  }

  /** Reset timer only — avoid serializing full metadata on every keystroke. */
  function rescheduleAutoDraftSaveIfPending() {
    if (autoSaveTimerRef.current == null) return
    clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null
      if (isHandlingSaveRef.current) return
      if (!isMetadataDirtyForAutoSave()) return
      runAutoDraftSaveRef.current()
    }, AUTO_DRAFT_SAVE_DELAY_MS)
  }

  useEffect(() => {
    return () => {
      clearAutoDraftSaveTimer()
    }
  }, [dossierId])

  useEffect(() => {
    const currentFocusKey = focusActivationKey(focusDocumentId, focusGroupIndex)
    const pending = pendingFieldActivationRef.current

    if (pending) {
      pendingFieldActivationRef.current = null
      setPdfHighlight(pending.highlight)
      setHighlightedFieldKey(pending.fieldKey)
      setHighlightedChangeId(pending.changeId ?? null)
      lastAppliedFocusRef.current = currentFocusKey
      return
    }

    if (lastAppliedFocusRef.current === currentFocusKey) {
      lastAppliedFocusRef.current = null
      return
    }

    setPdfHighlight(null)
    setHighlightedFieldKey(null)
  }, [focusDocumentId, focusGroupIndex])

  useEffect(() => {
    const currentNode = nodeRef.current
    const nextMetadata =
      resolveRecordPanelMetadata(currentNode, managementRole) ?? null
    const normalizedMetadata = nextMetadata
      ? propagateHoSoFondToDocuments(nextMetadata)
      : null
    setMetadataState(normalizedMetadata)
    baseMetadataRef.current =
      currentNode.fullDossierMetadata ?? nextMetadata ?? null
    setDetailTab('metadata')
    setDismissedRejectFieldKeys(new Set())
    lastRestoredFocusFieldKeyRef.current = null
    clearAutoDraftSaveTimer()
  }, [dossierContentKey, managementRole])

  useEffect(() => {
    setDismissedRejectFieldKeys(new Set())
  }, [node.rejectFields])

  useEffect(() => {
    qcReject.resetRejectState()
  }, [node.id, dossierId, qcReject.resetRejectState])

  useEffect(() => {
    setPdfHighlight(null)
    setHighlightedFieldKey(null)
    setHighlightedChangeId(null)
    setUseOriginalPdfFallback(false)
  }, [node.id, initialGroupIndex])

  useEffect(() => {
    setIsPdfMaskEnabled(defaultPdfMaskEnabled)
  }, [defaultPdfMaskEnabled, node.id])

  const editHistoryQuery = useQuery({
    ...dossierMetadataHistoryQueryOptions(dossierId),
    enabled: canViewEditHistory && Boolean(dossierId.trim()),
  })

  const didSyncTreeStatusRef = useRef(false)
  useEffect(() => {
    didSyncTreeStatusRef.current = false
  }, [dossierId])

  useEffect(() => {
    const apiStatus = workflowQuery.data?.status
    const treeStatus = effectiveDossierStatus
    if (!apiStatus || !treeStatus || String(apiStatus) === String(treeStatus)) {
      return
    }
    if (didSyncTreeStatusRef.current) return
    didSyncTreeStatusRef.current = true
    void queryClient.invalidateQueries({
      queryKey: [managementRole, 'data-management', 'tree'],
    })
  }, [
    workflowQuery.data?.status,
    effectiveDossierStatus,
    managementRole,
    queryClient,
  ])

  const editHistoryBatches = useMemo(() => {
    if (!canViewEditHistory || !activeMetadata || !editHistoryQuery.data) {
      return []
    }
    return mapMetadataHistoryToBatches(
      editHistoryQuery.data,
      activeMetadata,
      documents,
    )
  }, [canViewEditHistory, activeMetadata, editHistoryQuery.data, documents])

  const selectedGroupIndex = useMemo(() => {
    if (
      focusGroupIndex != null &&
      focusGroupIndex >= 0 &&
      focusGroupIndex < groups.length &&
      (!focusDocument || documentMatchingGroupIndices.includes(focusGroupIndex))
    ) {
      return focusGroupIndex
    }
    if (focusDocument) {
      return documentMatchingGroupIndices[0] ?? -1
    }
    return initialGroupIndex
  }, [
    documentMatchingGroupIndices,
    focusDocument,
    focusGroupIndex,
    groups.length,
    initialGroupIndex,
  ])

  const selectedGroup =
    selectedGroupIndex >= 0
      ? activeMetadata?.metadata_groups[selectedGroupIndex]
      : undefined

  const selectedDocument = useMemo(() => {
    if (focusDocument) return focusDocument

    if (selectedGroup) {
      return findDocumentForMetadataGroup(selectedGroup, documents) ?? null
    }

    return null
  }, [focusDocument, selectedGroup, documents])

  const ocrPdfUrl = useMemo(
    () =>
      selectedDocument ? resolveDocumentOcrPdfUrl(selectedDocument) : undefined,
    [selectedDocument],
  )
  const originalPdfUrl = selectedDocument?.fileUrl?.trim() || undefined
  const signedPdfUrl = selectedDocument?.signedFileUrl?.trim() || undefined
  const canViewSignedPdf = Boolean(selectedDocument?.isSigned && signedPdfUrl)

  useEffect(() => {
    setUseOriginalPdfFallback(false)
    // Prefer signed PDF when available so the visual stamp is visible after signing.
    setPdfViewMode(
      selectedDocument?.isSigned && signedPdfUrl ? 'signed' : 'source',
    )
    setPdfCurrentPage(1)
    setPdfScrollToPage(null)
    setPdfNumPages(null)
  }, [
    selectedDocument?.id,
    selectedDocument?.isSigned,
    ocrPdfUrl,
    signedPdfUrl,
  ])

  useEffect(() => {
    setPdfCurrentPage(1)
    setPdfScrollToPage(null)
    setPdfNumPages(null)
  }, [pdfViewMode])

  useEffect(() => {
    if (!canViewSignedPdf && pdfViewMode === 'signed') {
      setPdfViewMode('source')
    }
  }, [canViewSignedPdf, pdfViewMode])

  const sourcePdfUrl = useMemo(() => {
    if (!selectedDocument) return undefined
    if (useOriginalPdfFallback && originalPdfUrl) return originalPdfUrl
    if (ocrPdfUrl) return ocrPdfUrl
    return originalPdfUrl
  }, [selectedDocument, useOriginalPdfFallback, ocrPdfUrl, originalPdfUrl])

  const activePdfUrl =
    pdfViewMode === 'signed' && signedPdfUrl ? signedPdfUrl : sourcePdfUrl

  const isOcrPdfLayer = Boolean(
    pdfViewMode === 'source' &&
      activePdfUrl &&
      ocrPdfUrl &&
      activePdfUrl === ocrPdfUrl,
  )

  // Enable text layer for any source PDF (searchable_pdf or raw fallback) so
  // already-searchable originals still support select/copy when no OCR mirror exists.
  const shouldRenderTextLayer = Boolean(
    pdfViewMode === 'source' && activePdfUrl,
  )

  const handleOcrPdfLoadFailed = useCallback(() => {
    if (!ocrPdfUrl || !originalPdfUrl || useOriginalPdfFallback) return
    if (ocrPdfUrl === originalPdfUrl) return
    setUseOriginalPdfFallback(true)
  }, [ocrPdfUrl, originalPdfUrl, useOriginalPdfFallback])

  const pdfRevealRegions = useMemo(() => {
    if (!selectedGroup) return [] as Array<PdfBboxRevealRegion>

    const bboxesByPage = new Map<
      number,
      Array<[number, number, number, number]>
    >()
    selectedGroup.fields.forEach((field) => {
      if (field.page <= 0 || field.bboxes.length === 0) return
      const existing = bboxesByPage.get(field.page) ?? []
      bboxesByPage.set(field.page, [...existing, ...field.bboxes])
    })

    return selectedGroup.fields
      .filter((field) => field.page > 0 && field.bboxes.length > 0)
      .map((field) => ({
        page: field.page,
        bboxes: field.bboxes,
        sourcePageWidth: field.page_width,
        sourcePageHeight: field.page_height,
        referenceBboxes: bboxesByPage.get(field.page) ?? field.bboxes,
      }))
  }, [selectedGroup])

  useEffect(() => {
    if (!isEditorRole || !import.meta.env.DEV) return

    function handleMaskShortcut(event: globalThis.KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return
      if (event.code !== 'KeyM') return

      event.preventDefault()
      setIsPdfMaskEnabled((current) => !current)
    }

    window.addEventListener('keydown', handleMaskShortcut)
    return () => {
      window.removeEventListener('keydown', handleMaskShortcut)
    }
  }, [isEditorRole])

  useEffect(() => {
    const card = groupCardRefs.current.get(selectedGroupIndex)
    card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedGroupIndex, focusDocumentId])

  function handleGroupTitleClick(groupIndex: number) {
    suppressScrollSync()
    const group = activeMetadata?.metadata_groups[groupIndex]
    if (!group) return
    const matches = findAllDocumentsForMetadataGroup(group, documents)
    if (matches.length === 0) return

    const isSameGroup = selectedGroupIndex === groupIndex
    const currentDocIndex = focusDocumentId
      ? matches.findIndex((document) => document.id === focusDocumentId)
      : -1

    let nextDocIndex = 0
    if (isSameGroup && currentDocIndex >= 0 && matches.length > 1) {
      nextDocIndex = (currentDocIndex + 1) % matches.length
    } else if (currentDocIndex >= 0) {
      nextDocIndex = currentDocIndex
    }

    onFocusDocument?.(matches[nextDocIndex].id, groupIndex)
  }

  function focusMetadataField(key: string) {
    const target = fieldInputRefs.current.get(key)
    if (!target) return
    target.focus()
    try {
      const end = target.value.length
      target.setSelectionRange(end, end)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!focusFieldKey || !canEditFields) return
    if (!editableFieldKeys.includes(focusFieldKey)) return
    if (lastRestoredFocusFieldKeyRef.current === focusFieldKey) return

    const frameId = window.requestAnimationFrame(() => {
      if (!fieldInputRefs.current.has(focusFieldKey)) return
      lastRestoredFocusFieldKeyRef.current = focusFieldKey
      focusMetadataField(focusFieldKey)
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [focusFieldKey, canEditFields, editableFieldKeys, dossierContentKey])

  function markDocumentsCompleteWhenLeavingGroup(
    fromGroupIndex: number,
    toGroupIndex: number | null,
  ) {
    if (!onMarkDocumentsComplete || !activeMetadata) return
    const fromGroup = activeMetadata.metadata_groups[fromGroupIndex]
    if (!fromGroup) return

    const leavingDocs = findAllDocumentsForMetadataGroup(fromGroup, documents)
    if (leavingDocs.length === 0) return

    let stayingIds = new Set<string>()
    if (toGroupIndex != null) {
      const toGroup = activeMetadata.metadata_groups[toGroupIndex]
      if (toGroup) {
        stayingIds = new Set(
          findAllDocumentsForMetadataGroup(toGroup, documents).map(
            (doc) => doc.id,
          ),
        )
      }
    }

    const completedIds = leavingDocs
      .map((doc) => doc.id)
      .filter((id) => !stayingIds.has(id))
    if (completedIds.length === 0) return
    onMarkDocumentsComplete(completedIds)
  }

  function focusNextMetadataField(groupIndex: number, fieldIndex: number) {
    suppressScrollSync()
    const key = `${groupIndex}-${fieldIndex}`
    const position = editableFieldKeys.indexOf(key)
    if (position < 0) return

    for (let index = position + 1; index < editableFieldKeys.length; index++) {
      const nextKey = editableFieldKeys[index]
      if (!fieldInputRefs.current.has(nextKey)) continue

      const nextGroupIndex = Number(nextKey.split('-')[0])
      const nextFieldIndex = Number(nextKey.split('-')[1])
      focusMetadataField(nextKey)

      const nextField =
        activeMetadata?.metadata_groups[nextGroupIndex]?.fields[nextFieldIndex]
      if (nextField) {
        handleMetadataFieldActivate(
          nextGroupIndex,
          nextField,
          `${nextGroupIndex}-${nextField.name}-${nextFieldIndex}`,
          null,
          nextKey,
        )
      }

      if (nextGroupIndex !== groupIndex) {
        markDocumentsCompleteWhenLeavingGroup(groupIndex, nextGroupIndex)
        scheduleAutoDraftSave()
      }

      return
    }

    markDocumentsCompleteWhenLeavingGroup(groupIndex, null)
    scheduleAutoDraftSave()
    saveButtonRef.current?.focus()
  }

  function focusPreviousMetadataField(groupIndex: number, fieldIndex: number) {
    suppressScrollSync()
    const key = `${groupIndex}-${fieldIndex}`
    const position = editableFieldKeys.indexOf(key)
    if (position <= 0) return

    for (let index = position - 1; index >= 0; index--) {
      const prevKey = editableFieldKeys[index]
      if (!fieldInputRefs.current.has(prevKey)) continue

      const prevGroupIndex = Number(prevKey.split('-')[0])
      const prevFieldIndex = Number(prevKey.split('-')[1])
      focusMetadataField(prevKey)

      const prevField =
        activeMetadata?.metadata_groups[prevGroupIndex]?.fields[prevFieldIndex]
      if (prevField) {
        handleMetadataFieldActivate(
          prevGroupIndex,
          prevField,
          `${prevGroupIndex}-${prevField.name}-${prevFieldIndex}`,
          null,
          prevKey,
        )
      }

      return
    }
  }

  function handleMetadataFieldKeyDown(
    event: KeyboardEvent<HTMLElement>,
    groupIndex: number,
    fieldIndex: number,
    isTextArea: boolean = false,
  ) {
    handleMetadataFieldNavigationKeyDown(
      event,
      {
        focusNext: () => focusNextMetadataField(groupIndex, fieldIndex),
        focusPrevious: () => focusPreviousMetadataField(groupIndex, fieldIndex),
      },
      { isTextArea, alwaysNavigateOnEnter: true },
    )
  }

  function dismissEditorRejectField(
    group: DataMetadataGroupT,
    groupIndex: number,
    fieldName: string,
  ) {
    if (!isEditorRole) return
    const scope = resolveMetadataGroupRejectScope(group, groupIndex)
    const scopedKey = buildRejectFieldKey(
      scope.groupCode,
      fieldName,
      scope.fileRef,
    )
    const baseKey = buildRejectFieldKey(scope.groupCode, fieldName)
    const legacyKey = buildRejectFieldKey(group.group_code, fieldName)

    const keysToDismiss = [scopedKey, baseKey, legacyKey].filter((key) =>
      qcRejectFieldKeys.has(key),
    )
    if (keysToDismiss.length === 0) return

    setDismissedRejectFieldKeys((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const k of keysToDismiss) {
        if (!next.has(k)) {
          next.add(k)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }

  function isEditorRejectHighlighted(
    group: DataMetadataGroupT,
    groupIndex: number,
    fieldName: string,
  ): boolean {
    if (!isEditorRole) return false
    const scope = resolveMetadataGroupRejectScope(group, groupIndex)
    const scopedKey = buildRejectFieldKey(
      scope.groupCode,
      fieldName,
      scope.fileRef,
    )
    const baseKey = buildRejectFieldKey(scope.groupCode, fieldName)
    const legacyKey = buildRejectFieldKey(group.group_code, fieldName)

    return [scopedKey, baseKey, legacyKey].some(
      (key) => qcRejectFieldKeys.has(key) && !dismissedRejectFieldKeys.has(key),
    )
  }

  function handleFieldChange(
    targetGroupIndex: number,
    fieldIndex: number,
    value: string,
  ) {
    const targetGroup = activeMetadata?.metadata_groups[targetGroupIndex]
    const field = targetGroup?.fields[fieldIndex]
    if (targetGroup && field) {
      dismissEditorRejectField(targetGroup, targetGroupIndex, field.name)
    }

    const isFondField = Boolean(field && isFondFieldName(field.name))

    setMetadataState((prev) => {
      if (!prev) return prev
      if (isFondField) {
        const next = syncFondValueAcrossMetadata(prev, value)
        metadataStateRef.current = next
        return next
      }
      const nextGroups = prev.metadata_groups.map((group, groupIndex) => {
        if (groupIndex !== targetGroupIndex) return group
        return {
          ...group,
          fields: group.fields.map((currentField, currentFieldIndex) =>
            currentFieldIndex === fieldIndex
              ? { ...currentField, value }
              : currentField,
          ),
        }
      })
      const next = { ...prev, metadata_groups: nextGroups }
      metadataStateRef.current = next
      return next
    })
    rescheduleAutoDraftSaveIfPending()
  }

  const pdfDocs = useMemo(() => {
    return documents.filter((doc) =>
      isPdfDocumentRef(doc.filePath || doc.name || ''),
    )
  }, [documents])

  const pdfDocumentIndex = useMemo(() => {
    if (!selectedDocument) return -1
    return pdfDocs.findIndex((doc) => doc.id === selectedDocument.id)
  }, [pdfDocs, selectedDocument])

  const handlePdfGoToPage = useCallback((page: number) => {
    setPdfCurrentPage(page)
    // Force PdfViewer scroll effect to re-run even when already on this page.
    setPdfScrollToPage(null)
    requestAnimationFrame(() => {
      setPdfScrollToPage(page)
    })
  }, [])

  const handlePdfGoToDocument = useCallback(
    (index: number) => {
      const doc = pdfDocs[index]
      if (!doc) return
      const matchingGroups = findAllMetadataGroupIndicesForDocument(
        groups,
        doc,
        documents,
      )
      const groupIndex =
        matchingGroups[0] ?? (selectedGroupIndex >= 0 ? selectedGroupIndex : 0)
      onFocusDocument?.(doc.id, groupIndex)
    },
    [documents, groups, onFocusDocument, pdfDocs, selectedGroupIndex],
  )

  function handleLinkChange(groupIndex: number, val: string) {
    const group = activeMetadata?.metadata_groups[groupIndex]
    if (!group) return

    let file_name = ''
    let file_path = ''

    if (val === 'none') {
      setMetadataState((prev) => {
        if (!prev) return prev
        const nextGroups = prev.metadata_groups.map((g, idx) => {
          if (idx !== groupIndex) return g
          const { source_document: _, ...rest } = g
          return rest
        })
        const next = { ...prev, metadata_groups: nextGroups }
        metadataStateRef.current = next
        return next
      })
      rescheduleAutoDraftSaveIfPending()
      return
    }

    if (val === 'current_missing') {
      file_name = group.source_document?.file_name || ''
      file_path = group.source_document?.file_path || ''
    } else {
      const doc = pdfDocs.find((d) => d.id === val)
      if (doc) {
        file_name = doc.name
        file_path =
          doc.filePath ||
          (dossierFolderHint
            ? `raw/${dossierFolderHint}/${doc.name}`
            : doc.name)
      }
    }

    setMetadataState((prev) => {
      if (!prev) return prev
      const nextGroups = prev.metadata_groups.map((g, idx) => {
        if (idx !== groupIndex) return g
        return {
          ...g,
          source_document: {
            file_name,
            file_path,
          },
        }
      })
      const next = { ...prev, metadata_groups: nextGroups }
      metadataStateRef.current = next
      return next
    })
    rescheduleAutoDraftSaveIfPending()
  }

  function resolveNavigationFieldKey(
    groupIndex: number,
    fieldKey: string,
    navigationFieldKey?: string,
  ): string | undefined {
    if (navigationFieldKey) return navigationFieldKey
    const match = /^(\d+)-.+-(\d+)$/.exec(fieldKey)
    if (match) return `${match[1]}-${match[2]}`
    if (editableFieldKeys.some((key) => key.startsWith(`${groupIndex}-`))) {
      return editableFieldKeys.find((key) => key.startsWith(`${groupIndex}-`))
    }
    return undefined
  }

  function handleMetadataFieldActivate(
    groupIndex: number,
    field: DataDocumentFieldT,
    fieldKey: string,
    changeId?: string | null,
    navigationFieldKey?: string,
  ) {
    suppressScrollSync()
    const group = activeMetadata?.metadata_groups[groupIndex]
    if (!group) return

    const highlight = fieldToHighlight(field, group.fields)
    const linkedDocuments = findAllDocumentsForMetadataGroup(group, documents)
    const navKey = resolveNavigationFieldKey(
      groupIndex,
      fieldKey,
      navigationFieldKey,
    )

    if (linkedDocuments.length > 0) {
      const targetDocument = linkedDocuments[0]
      const needsFocusChange =
        targetDocument.id !== focusDocumentId ||
        groupIndex !== selectedGroupIndex

      if (needsFocusChange) {
        pendingFieldActivationRef.current = {
          fieldKey,
          highlight,
          changeId: changeId ?? null,
        }
        onFocusDocument?.(targetDocument.id, groupIndex, navKey)
        return
      }

      // Same PDF/group: update highlight locally — skip router navigate (lag).
    } else if (groupIndex !== selectedGroupIndex) {
      onFocusDocument?.(undefined, groupIndex, navKey)
    }

    pendingFieldActivationRef.current = null
    setPdfHighlight(highlight)
    setHighlightedFieldKey(fieldKey)
    setHighlightedChangeId(changeId ?? null)
  }

  // --- Scroll-sync: auto-highlight the most-visible field while scrolling ---
  const handleScrollSyncFieldChange = useCallback(
    (groupIndex: number, fieldIndex: number) => {
      const group = activeMetadata?.metadata_groups[groupIndex]
      if (!group) return
      const field = group.fields[fieldIndex]
      if (!field) return
      const fieldKey = `${groupIndex}-${field.name}-${fieldIndex}`
      handleMetadataFieldActivate(groupIndex, field, fieldKey)
    },
    // activeMetadata changes identity when fields are edited; the function
    // body reads it via closure so we track the ref rather than the object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeMetadata?.metadata_groups, documents, focusDocumentId, selectedGroupIndex],
  )

  const { suppressScrollSync } = useScrollSyncHighlight({
    scrollContainerRef: metadataScrollRef,
    onVisibleFieldChange: handleScrollSyncFieldChange,
    enabled: detailTab === 'metadata' && visibleMetadataGroupCount > 0,
  })

  function handleHistoryFieldActivate(change: DataMetadataEditFieldChangeT) {
    // Use documentRef if available to identify correct document
    const documentRef = change.documentRef

    if (documentRef) {
      // Find the matching document in tree
      const targetDocument = documents.find(
        (doc) =>
          doc.name.includes(documentRef) ||
          doc.filePath?.includes(documentRef) ||
          doc.fileUrl?.includes(documentRef),
      )

      if (targetDocument) {
        // Find group index for this document
        const groupIndex = findMetadataGroupIndexForDocument(
          groups,
          targetDocument,
          documents,
        )

        // Store field activation info for after document focus
        const fieldKey = `${groupIndex}-${change.fieldName}-${change.fieldIndex}`
        const group = groups[groupIndex]
        const highlight = group
          ? fieldToHighlight(change.field, group.fields)
          : null

        pendingFieldActivationRef.current = {
          fieldKey,
          highlight: highlight ?? undefined,
          changeId: change.id,
        }

        // Switch to metadata tab if currently on editHistory
        if (detailTab === 'editHistory') {
          setDetailTab('metadata')
        }

        // Focus document with 'metadata' tab (useEffect will sync if needed)
        onFocusDocument?.(targetDocument.id, groupIndex, 'metadata')
        return
      }
    }

    // Fallback: if we have groupIndex >= 0, use old logic
    if (change.groupIndex >= 0) {
      const fieldKey = `${change.groupIndex}-${change.fieldName}-${change.fieldIndex}`
      handleMetadataFieldActivate(
        change.groupIndex,
        change.field,
        fieldKey,
        change.id,
      )
      return
    }

    // Last resort: if groupIndex < 0 and no documentRef, still switch to metadata tab
    // User will see metadata even if exact field cannot be focused
    if (detailTab === 'editHistory') {
      setDetailTab('metadata')
      onFocusDocument?.('', 0, 'metadata')
    }
  }

  function handleHistoryFileFocus(file: DataMetadataHistoryFileRefT) {
    let groupIndex = file.groupIndex
    const documentId = file.documentId?.trim() || ''

    if (documentId) {
      const targetDocument = documents.find((item) => item.id === documentId)
      if (targetDocument && (groupIndex < 0 || !groups[groupIndex])) {
        groupIndex = findMetadataGroupIndexForDocument(
          groups,
          targetDocument,
          documents,
        )
      }

      // useEffect will sync tab to 'metadata' when focusDocumentId changes
      onFocusDocument?.(documentId, groupIndex >= 0 ? groupIndex : 0, 'metadata')
      window.requestAnimationFrame(() => {
        window.document
          .querySelector(`[data-tree-node-id="${documentId}"]`)
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      })
      return
    }

    const group = activeMetadata?.metadata_groups[groupIndex]
    if (!group) return

    const linkedDocuments = findAllDocumentsForMetadataGroup(group, documents)
    if (linkedDocuments.length > 0) {
      const targetDocument = linkedDocuments[0]
      // useEffect will sync tab to 'metadata' when focusDocumentId changes
      onFocusDocument?.(targetDocument.id, groupIndex, 'metadata')
      window.requestAnimationFrame(() => {
        window.document
          .querySelector(`[data-tree-node-id="${targetDocument.id}"]`)
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      })
      return
    }

    if (groupIndex !== selectedGroupIndex && onFocusDocument) {
      // useEffect will sync tab to 'metadata' when focusDocumentId changes
      onFocusDocument('', groupIndex, 'metadata')
    }
  }

  function handleRequestRevertHistoryBatch(batch: DataMetadataEditBatchT) {
    if (!dossierId.trim() || restoreHistoryMutation.isPending) return
    setPendingRevertBatch(batch)
  }

  async function handleConfirmRevertHistoryBatch() {
    if (
      !pendingRevertBatch ||
      !dossierId.trim() ||
      restoreHistoryMutation.isPending
    ) {
      return
    }

    const batch = pendingRevertBatch
    setRestoringBatchId(batch.id)
    try {
      await restoreHistoryMutation.mutateAsync({
        dossierId,
        historyId: batch.id,
      })
      try {
        await onWorkflowComplete?.(dossierId)
      } catch {
        return
      }
      setPendingRevertBatch(null)
      setDetailTab('metadata')
      toast.success(t('recordDetail.editHistory.revertSuccess'))
    } catch {
      toast.error(t('recordDetail.editHistory.revertError'))
    } finally {
      setRestoringBatchId(null)
    }
  }

  function handleDetailTabChange(value: string) {
    setDetailTab(value as 'metadata' | 'editHistory')
    setPdfHighlight(null)
    setHighlightedFieldKey(null)
    setHighlightedChangeId(null)
  }

  const exportContext: ExportContext | null = useMemo(() => {
    if (!canExport || !dossierId.trim()) return null
    return {
      kind: 'dossier',
      folderId: null,
      dossierId,
      downloadName: activeMetadata?.ho_so_id?.trim() || node.name,
    }
  }, [canExport, dossierId, activeMetadata?.ho_so_id, node.name])

  const handleExport = useCallback(
    async (mode: ExportMode, options?: ExportOptions) => {
      if (!exportContext || isExporting) return

      setIsExporting(true)
      setExportingMode(mode)
      try {
        await runExport({
          kind: exportContext.kind,
          mode,
          folderId: exportContext.folderId,
          dossierId: exportContext.dossierId,
          downloadName: exportContext.downloadName,
          metadataExportConfig: options?.presetId
            ? { presetId: options.presetId }
            : undefined,
          useDocumentNaming: options?.useDocumentNaming === true,
        })
        toast.success(
          mode === 'dip'
            ? t('recordDetail.exportDipSuccess')
            : mode === 'tiff'
              ? t('recordDetail.exportTiffSuccess')
              : t('recordDetail.exportExcelSuccess'),
        )
        setExportDialogOpen(false)
      } catch (error) {
        toast.error(
          translateError(
            error instanceof Error
              ? error
              : new Error(t('recordDetail.exportExcelError')),
          ),
        )
      } finally {
        setIsExporting(false)
        setExportingMode(null)
      }
    },
    [exportContext, isExporting, t],
  )

  async function handleSaveMetadata(mode: EditorMetadataSaveMode = 'draft') {
    const latestMetadata = metadataStateRef.current ?? activeMetadata
    if (isHandlingSave || !latestMetadata || !dossierId.trim()) return

    const isDraftMode = mode === 'draft' || mode === 'draft_advance'

    clearAutoDraftSaveTimer()
    setIsHandlingSave(true)
    const hasSlotAcl = isEditorRole && Boolean(node.allowedFields?.length)
    const baseMetadata = baseMetadataRef.current ?? latestMetadata
    const payload = hasSlotAcl
      ? latestMetadata
      : mergeMetadataFieldChanges(baseMetadata, latestMetadata)
    const storagePayload = serializeDossierMetadataForStorage(payload)

    try {
      if (isEditorRole && mode === 'final') {
        let isPartialSubmit = false
        if (isEditorDraftDossier) {
          const result = await finalSaveMutation.mutateAsync([
            { dossierId, metadata: payload },
          ])
          if (result.failedCount > 0) {
            toast.error(t('metadata.finalSaveError'))
            return
          }
          isPartialSubmit = result.submitted.some((item) => item.partial)
        } else {
          const saveResult = await saveMutation.mutateAsync({
            dossierId,
            metadata: payload,
            isDraft: false,
            storagePayload,
          })
          isPartialSubmit = saveResult?.partial === true
        }
        baseMetadataRef.current =
          hasSlotAcl && baseMetadataRef.current
            ? mergeMetadataFieldChanges(baseMetadataRef.current, latestMetadata)
            : payload
        try {
          await onWorkflowComplete?.(dossierId, 'final')
        } catch {
          return
        }
        toast.success(
          isPartialSubmit
            ? t('metadata.finalSavePartialSuccess')
            : t('metadata.finalSaveSuccess'),
        )
        return
      }

      await saveMutation.mutateAsync({
        dossierId,
        metadata: payload,
        isDraft: isEditorRole && isDraftMode,
        saveMode: 'approve',
        storagePayload,
      })
      baseMetadataRef.current =
        hasSlotAcl && baseMetadataRef.current
          ? mergeMetadataFieldChanges(baseMetadataRef.current, latestMetadata)
          : payload

      if (isEditorRole && isDraftMode) {
        // Auto-save: quiet toast (replace same id) + no tree refresh.
        // Manual Lưu nháp: claim next via onWorkflowComplete.
        if (mode === 'draft_advance') {
          toast.success(t('metadata.saveDraftSuccess'))
          try {
            await onWorkflowComplete?.(dossierId, mode)
          } catch {
            return
          }
        } else {
          toast.success(t('metadata.saveDraftSuccess'), {
            id: 'metadata-auto-draft-save',
          })
          void queryClient.invalidateQueries({
            queryKey: editorDraftDossiersQueryKey,
          })
        }
        return
      }

      try {
        await onWorkflowComplete?.(dossierId, mode)
      } catch {
        return
      }

      toast.success(
        isActingAsQc ? t('metadata.approveSuccess') : t('metadata.saveSuccess'),
      )
    } catch (error) {
      toast.error(translateError(error))
    } finally {
      setIsHandlingSave(false)
    }
  }

  runAutoDraftSaveRef.current = () => {
    void handleSaveMetadata('draft')
  }

  if (!activeMetadata) {
    const isMetadataLoading =
      isRecordContentPending ||
      (!isNodeChildrenCached(node.id) && metadata == null)
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">
          {isMetadataLoading
            ? t('recordDetail.loadingMetadata')
            : t('recordDetail.metadataUnavailable')}
        </p>
      </div>
    )
  }

  const canShowDetailLayout =
    visibleMetadataGroupCount > 0 || focusDocument != null

  if (!canShowDetailLayout) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {t('recordDetail.noFields')}
      </p>
    )
  }

  const isSaving =
    isHandlingSave ||
    saveMutation.isPending ||
    finalSaveMutation.isPending ||
    qcReject.isRejectPending
  const isDraftSaving = saveMutation.isPending && !finalSaveMutation.isPending
  const isFinalSaving = finalSaveMutation.isPending

  function buildFieldRejectMark(
    group: DataMetadataGroupT,
    groupIndex: number,
    field: DataDocumentFieldT,
  ) {
    if (!isActingAsQc || !canShowSubmitButton || canDirectApprove) return undefined

    const scope = resolveMetadataGroupRejectScope(group, groupIndex)
    const rejectKey = buildRejectFieldKey(
      scope.groupCode,
      field.name,
      scope.fileRef,
    )
    return {
      id: `qc-reject-${groupIndex}-${rejectKey}`,
      checked: qcReject.rejectFieldKeys.has(rejectKey),
      onCheckedChange: (checked: boolean) =>
        qcReject.toggleRejectField(rejectKey, checked),
      disabled: isSaving,
    }
  }

  function renderMetadataGroupCard(
    entry: MetadataGroupEntry,
    titleOverride?: string | null,
  ) {
    const { group, groupIndex } = entry
    return (
      <RecordMetadataGroupCard
        group={group}
        groupIndex={groupIndex}
        titleOverride={titleOverride}
        dossierFolderHint={dossierFolderHint}
        documents={documents}
        pdfDocs={pdfDocs}
        isActiveGroup={groupIndex === selectedGroupIndex}
        canEditFields={canEditFields}
        isEditorRole={isEditorRole}
        isSaving={isSaving}
        highlightedFieldKey={highlightedFieldKey}
        groupCardRefs={groupCardRefs}
        fieldInputRefs={fieldInputRefs}
        onGroupTitleClick={handleGroupTitleClick}
        onLinkChange={handleLinkChange}
        onFieldChange={handleFieldChange}
        onFieldActivate={handleMetadataFieldActivate}
        onFieldKeyDown={handleMetadataFieldKeyDown}
        buildFieldRejectMark={buildFieldRejectMark}
        isEditorRejectHighlighted={isEditorRejectHighlighted}
        t={t}
      />
    )
  }

  function renderMetadataGroupsSection(
    title: string,
    entries: Array<MetadataGroupEntry>,
    resolveTitle?: (entry: MetadataGroupEntry) => string | null,
  ) {
    if (entries.length === 0) return null

    return (
      <div className="flex flex-col gap-2">
        <h3 className="shrink-0 text-sm font-medium text-foreground">
          {title}
        </h3>
        <div className="rounded-md border border-border">
          <div className="grid gap-3 p-3">
            {entries.map((entry) =>
              renderMetadataGroupCard(entry, resolveTitle?.(entry) ?? null),
            )}
          </div>
        </div>
      </div>
    )
  }

  const metadataPanelContent = (
    <>
      {canReviewErrorReports && pendingErrorReportCount > 0 ? (
        <EditorErrorReportAlertBanner
          pendingCount={pendingErrorReportCount}
          alertKey={
            pendingErrorReportCount > 1
              ? 'editorErrorReport.alert.pendingForQcMultiple'
              : pendingErrorReports[0]?.status === 'pending_manager'
                ? 'editorErrorReport.alert.pendingForManager'
                : 'editorErrorReport.alert.pendingForQc'
          }
          onViewDetails={() => setErrorReportReviewOpen(true)}
        />
      ) : null}

      {isEditorRole && editorPendingErrorReport ? (
        <div className="shrink-0 rounded-md border border-border bg-muted/40 p-3">
          <p className="text-sm text-muted-foreground">
            {t('editorErrorReport.alert.pendingSubmission')}
          </p>
        </div>
      ) : null}

      {isEditorRole &&
      !editorPendingErrorReport &&
      rejectedErrorReport?.rejectNote?.trim() ? (
        <EditorErrorReportAlertBanner
          report={rejectedErrorReport}
          alertKey="editorErrorReport.alert.rejected"
        />
      ) : null}

      {isEditorRole &&
      (node.lastRejectNotes?.trim() || rejectedFieldSummary.length > 0) ? (
        <div className="shrink-0 rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-sm font-medium text-destructive">
            {t('metadata.editorReject.title')}
          </p>
          {node.lastRejectNotes?.trim() ? (
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {node.lastRejectNotes.trim()}
            </p>
          ) : null}
          {rejectedFieldSummary.length > 0 ? (
            <div className="mt-3 space-y-2 border-t border-destructive/20 pt-2">
              <p className="text-xs font-semibold text-destructive">
                {t('metadata.editorReject.detailsTitle')}
              </p>
              <ul className="space-y-1.5 text-xs text-foreground">
                {rejectedFieldSummary.map((item) => (
                  <li key={item.fileKey} className="flex flex-col gap-0.5">
                    <span className="font-medium text-destructive">
                      • {item.fileLabel}:
                    </span>
                    <span className="pl-3 text-muted-foreground">
                      {item.fieldLabels.join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {visibleMetadataGroupCount > 0 ? (
        <div className="flex flex-col gap-4">
          {isActingAsQc && canShowSubmitButton && !canDirectApprove ? (
            <p className="shrink-0 text-xs text-muted-foreground">
              {t('metadata.rejectInline.hint')}
            </p>
          ) : null}
          {isEditorRole && qcRejectFieldKeys.size > 0 ? (
            <p className="shrink-0 text-xs text-muted-foreground">
              {t('metadata.editorReject.fieldHint')}
            </p>
          ) : null}

          {metadataDisplayLayout.layout === 'tt05' ? (
            <>
              {metadataDisplayLayout.hoSoEntry
                ? renderMetadataGroupsSection(
                    metadataDisplayLayout.hoSoEntry.group.group_name.trim() ||
                      t('recordDetail.hoSoMetadataTitle'),
                    [metadataDisplayLayout.hoSoEntry],
                  )
                : null}
              {metadataDisplayLayout.taiLieuEntries.length > 0
                ? renderMetadataGroupsSection(
                    metadataDisplayLayout.taiLieuEntries[0]!.group.group_name.trim() ||
                      t('recordDetail.archivalDocumentsTitle'),
                    metadataDisplayLayout.taiLieuEntries,
                    (entry) => getTaiLieuDocumentDisplayTitle(entry.group),
                  )
                : null}
              {metadataDisplayLayout.legacyEntries.length > 0
                ? renderMetadataGroupsSection(
                    t('recordDetail.documentsTitle'),
                    metadataDisplayLayout.legacyEntries,
                  )
                : null}
            </>
          ) : (
            renderMetadataGroupsSection(
              t('recordDetail.documentsTitle'),
              metadataDisplayLayout.legacyEntries,
            )
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {ocrPendingEmptyMetadataMessage ?? t('recordDetail.noFields')}
        </p>
      )}

      {canShowSubmitButton &&
      isActingAsQc &&
      !canDirectApprove &&
      qcReject.isRejectMode ? (
        <QcInlineRejectBar
          selectedCount={qcReject.rejectFieldKeys.size}
          notes={qcReject.rejectNotes}
          onNotesChange={qcReject.setRejectNotes}
          onClear={qcReject.clearRejectSelection}
          onSubmit={qcReject.submitReject}
          isPending={qcReject.isRejectPending}
        />
      ) : canShowSubmitButton || canExport || canDigitalSign || isEditorRole ? (
        <div className="flex shrink-0 justify-end gap-1.5 border-t border-border pt-1.5">
          {isEditorRole ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="gap-1.5"
              onClick={() => setErrorReportDialogOpen(true)}
              disabled={!canSubmitErrorReport || !activeMetadata}
            >
              <AlertTriangle className="size-3.5" aria-hidden />
              {t('editorErrorReport.actions.report')}
            </Button>
          ) : null}
          {canDigitalSign ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                void (async () => {
                  const ready = await ensureSignAgentReady()
                  if (!ready.ok) {
                    toast.error(ready.message, {
                      action: ready.downloadUrl
                        ? {
                            label: 'Tải Sign Agent',
                            onClick: () =>
                              window.open(
                                ready.downloadUrl ?? SIGN_AGENT_DOWNLOAD_URL,
                                '_blank',
                                'noopener,noreferrer',
                              ),
                          }
                        : undefined,
                    })
                    return
                  }
                  setSignInitialFileId(
                    selectedDocument?.isSigned ? selectedDocument.id : null,
                  )
                  setSignDialogOpen(true)
                })()
              }}
            >
              <PenLine className="size-3.5" aria-hidden />
              {selectedDocument?.isSigned
                ? t('digitalSign.resignAction')
                : t('digitalSign.action')}
            </Button>
          ) : null}
          {canExport ? (
            <Button
              type="button"
              size="sm"
              variant={canShowSubmitButton ? 'outline' : 'default'}
              className="gap-1.5"
              onClick={() => setExportDialogOpen(true)}
            >
              <FileDown className="size-3.5" aria-hidden />
              {t('recordDetail.exportExcel')}
            </Button>
          ) : null}
          {canShowSubmitButton ? (
            isEditorRole ? (
              <>
                {!isEditorDraftDossier ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => void handleSaveMetadata('draft_advance')}
                    disabled={isSaving}
                  >
                    {isDraftSaving ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Save className="size-3.5" aria-hidden />
                    )}
                    {isDraftSaving
                      ? t('metadata.savingDraft')
                      : t('metadata.saveDraft')}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => void handleSaveMetadata('final')}
                  disabled={isSaving}
                  ref={saveButtonRef}
                >
                  {isFinalSaving ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Save className="size-3.5" aria-hidden />
                  )}
                  {isFinalSaving
                    ? t('metadata.submittingFinal')
                    : t('metadata.finalSave')}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={() => void handleSaveMetadata()}
                disabled={isSaving || isApproveBlockedByErrorReports}
                ref={saveButtonRef}
                title={
                  isApproveBlockedByErrorReports
                    ? t('editorErrorReport.alert.approveBlocked')
                    : undefined
                }
              >
                {isSaving ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Save className="size-3.5" aria-hidden />
                )}
                {isSaving
                  ? isActingAsQc
                    ? t('metadata.approving')
                    : t('metadata.saving')
                  : isActingAsQc
                    ? t('metadata.approve')
                    : t('metadata.save')}
              </Button>
            )
          ) : null}
        </div>
      ) : null}
    </>
  )

  return (
    <div className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-border p-2 lg:min-h-0 lg:border-r">
          {canViewEditHistory ? (
            <Tabs
              value={detailTab}
              onValueChange={handleDetailTabChange}
              className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden"
            >
              <TabsList className="grid h-8 w-full shrink-0 grid-cols-2 p-0.5">
                <TabsTrigger
                  value="metadata"
                  className="h-full px-2 py-0 text-xs leading-none"
                >
                  {t('recordDetail.tabs.metadata')}
                </TabsTrigger>
                <TabsTrigger
                  value="editHistory"
                  className="h-full px-2 py-0 text-xs leading-none"
                >
                  {t('recordDetail.tabs.editHistory')}
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="metadata"
                className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain data-[state=inactive]:hidden"
                ref={metadataScrollRef}
              >
                <div className="flex flex-col gap-3 pb-2">
                  {metadataPanelContent}
                </div>
              </TabsContent>
              <TabsContent
                value="editHistory"
                className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain data-[state=inactive]:hidden"
              >
                <RecordMetadataEditHistorySection
                  batches={editHistoryBatches}
                  highlightedChangeId={highlightedChangeId}
                  isLoading={editHistoryQuery.isLoading}
                  isError={editHistoryQuery.isError}
                  isRestoring={restoreHistoryMutation.isPending}
                  restoringBatchId={restoringBatchId}
                  onFieldActivate={handleHistoryFieldActivate}
                  onFileActivate={handleHistoryFileFocus}
                  onRevertBatch={handleRequestRevertHistoryBatch}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="flex flex-col gap-3 pb-2">
                {metadataPanelContent}
              </div>
            </div>
          )}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2">
          {canViewSignedPdf ? (
            <Tabs
              value={pdfViewMode}
              onValueChange={(value) =>
                setPdfViewMode(value === 'signed' ? 'signed' : 'source')
              }
              className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden"
            >
              <TabsList className="mb-1.5 grid h-8 w-full shrink-0 grid-cols-2 p-0.5">
                <TabsTrigger
                  value="source"
                  className="h-full px-2 py-0 text-xs leading-none"
                >
                  {t('recordDetail.pdfTabs.source')}
                </TabsTrigger>
                <TabsTrigger
                  value="signed"
                  className="h-full px-2 py-0 text-xs leading-none"
                >
                  {t('recordDetail.pdfTabs.signed')}
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value={pdfViewMode}
                forceMount
                className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
              >
                {activePdfUrl ? (
                  <>
                    <PdfViewerToolbar
                      className="mb-1.5"
                      currentPage={pdfCurrentPage}
                      numPages={pdfNumPages}
                      onGoToPage={handlePdfGoToPage}
                      documentIndex={pdfDocumentIndex}
                      documentCount={pdfDocs.length}
                      onGoToDocument={handlePdfGoToDocument}
                      scale={pdfZoomScale}
                      onScaleChange={setPdfZoomScale}
                    />
                    <PdfViewer
                      key={`${selectedDocument?.id ?? 'none'}-${pdfViewMode}-${isOcrPdfLayer ? 'ocr' : 'raw'}`}
                      fileUrl={activePdfUrl}
                      fileName={selectedDocument?.name}
                      className="h-0 min-h-0 flex-1"
                      showBorder={false}
                      scale={pdfZoomScale}
                      scrollToPage={pdfScrollToPage}
                      onVisiblePageChange={setPdfCurrentPage}
                      onNumPagesChange={setPdfNumPages}
                      highlight={pdfViewMode === 'source' ? pdfHighlight : null}
                      maskMode={
                        pdfViewMode === 'source' &&
                        isEditorRole &&
                        isPdfMaskEnabled
                          ? 'bbox-only'
                          : 'off'
                      }
                      revealRegions={
                        pdfViewMode === 'source' ? pdfRevealRegions : []
                      }
                      renderTextLayer={shouldRenderTextLayer}
                      renderAnnotationLayer={shouldRenderTextLayer}
                      restrictTextCopyToRevealRegions={
                        isEditorRole &&
                        isPdfMaskEnabled &&
                        shouldRenderTextLayer
                      }
                      onLoadFailed={
                        isOcrPdfLayer && originalPdfUrl
                          ? handleOcrPdfLoadFailed
                          : undefined
                      }
                    />
                  </>
                ) : (
                  <div className="flex h-full min-h-0 items-center justify-center rounded-lg bg-muted/30 p-4">
                    <p className="text-center text-sm text-muted-foreground">
                      {t('recordDetail.noPdfForGroup')}
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : activePdfUrl ? (
            <>
              <PdfViewerToolbar
                className="mb-1.5"
                currentPage={pdfCurrentPage}
                numPages={pdfNumPages}
                onGoToPage={handlePdfGoToPage}
                documentIndex={pdfDocumentIndex}
                documentCount={pdfDocs.length}
                onGoToDocument={handlePdfGoToDocument}
                scale={pdfZoomScale}
                onScaleChange={setPdfZoomScale}
              />
              <PdfViewer
                key={`${selectedDocument?.id ?? 'none'}-${isOcrPdfLayer ? 'ocr' : 'original'}`}
                fileUrl={activePdfUrl}
                fileName={selectedDocument?.name}
                className="h-0 min-h-0 flex-1"
                showBorder={false}
                scale={pdfZoomScale}
                scrollToPage={pdfScrollToPage}
                onVisiblePageChange={setPdfCurrentPage}
                onNumPagesChange={setPdfNumPages}
                highlight={pdfHighlight}
                maskMode={
                  isEditorRole && isPdfMaskEnabled ? 'bbox-only' : 'off'
                }
                revealRegions={pdfRevealRegions}
                renderTextLayer={shouldRenderTextLayer}
                renderAnnotationLayer={shouldRenderTextLayer}
                restrictTextCopyToRevealRegions={
                  isEditorRole && isPdfMaskEnabled && shouldRenderTextLayer
                }
                onLoadFailed={
                  isOcrPdfLayer && originalPdfUrl
                    ? handleOcrPdfLoadFailed
                    : undefined
                }
              />
            </>
          ) : (
            <div className="flex h-full min-h-0 items-center justify-center rounded-lg bg-muted/30 p-4">
              <p className="text-center text-sm text-muted-foreground">
                {t('recordDetail.noPdfForGroup')}
              </p>
            </div>
          )}
        </div>
      </div>
      <ExportChoiceDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        context={exportContext}
        canExportDip={Boolean(exportContext?.dossierId)}
        onExport={handleExport}
        isExporting={isExporting}
        exportingMode={exportingMode}
      />
      <RevertMetadataHistoryDialog
        open={pendingRevertBatch != null}
        onOpenChange={(open) => {
          if (!open && !restoreHistoryMutation.isPending) {
            setPendingRevertBatch(null)
          }
        }}
        batch={pendingRevertBatch}
        onConfirm={handleConfirmRevertHistoryBatch}
        isConfirming={restoreHistoryMutation.isPending}
      />
      {activeMetadata ? (
        <EditorErrorReportDialog
          open={errorReportDialogOpen}
          onOpenChange={setErrorReportDialogOpen}
          dossierId={dossierId}
          dossierName={node.name}
          metadata={mergeMetadataFieldChanges(
            baseMetadataRef.current ?? activeMetadata,
            activeMetadata,
          )}
          onSubmitReport={async (input) => {
            await editorErrorReports.submitReport(input)
            if (isEditorRole) {
              await onWorkflowComplete?.(dossierId, 'error_report')
            }
          }}
        />
      ) : null}
      <EditorErrorReportReviewDialog
        open={errorReportReviewOpen}
        onOpenChange={setErrorReportReviewOpen}
        dossierName={node.name}
        reports={errorReportsForReview}
        isActionPending={editorErrorReports.isActionPending}
        canActOnReport={editorErrorReports.canActOnReport}
        canForward={editorErrorReports.canForward}
        onConfirm={async (report) => {
          await editorErrorReports.confirmReport(report)
        }}
        onReject={async (report, rejectNote) => {
          await editorErrorReports.rejectReport(report, {
            rejectNote,
            rejectFields: [],
          })
        }}
        onForward={async (report) => {
          await editorErrorReports.forwardReport(report)
          await onWorkflowComplete?.(dossierId)
        }}
      />
      <DigitalSignDialog
        open={signDialogOpen}
        onOpenChange={(open) => {
          setSignDialogOpen(open)
          if (!open) setSignInitialFileId(null)
        }}
        dossierId={dossierId}
        dossierName={node.name}
        initialFileId={signInitialFileId}
        onCompleted={() => {
          if (onDigitalSignCompleted) {
            onDigitalSignCompleted(dossierId)
            return
          }
          void onWorkflowComplete?.(dossierId)
        }}
      />
    </div>
  )
}
