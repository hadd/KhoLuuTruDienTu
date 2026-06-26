import { AlertTriangle, FileDown, Loader2, Save } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PdfViewer } from '@/components/common/PdfViewer'
import type {
  PdfBboxRevealRegion,
  PdfFieldHighlight,
} from '@/components/common/PdfViewer'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ExportChoiceDialog } from '@/features/data-management/components/ExportChoiceDialog'
import { EditorErrorReportAlertBanner } from '@/features/data-management/components/EditorErrorReportAlertBanner'
import { EditorErrorReportDialog } from '@/features/data-management/components/EditorErrorReportDialog'
import { EditorErrorReportReviewDialog } from '@/features/data-management/components/EditorErrorReportReviewDialog'
import { MetadataFieldInput } from '@/features/data-management/components/MetadataFieldInput'
import { MetadataFieldRow } from '@/features/data-management/components/MetadataFieldRow'
import { QcInlineRejectBar } from '@/features/data-management/components/QcInlineRejectBar'
import { RecordMetadataEditHistorySection } from '@/features/data-management/components/RecordMetadataEditHistorySection'
import { RevertMetadataHistoryDialog } from '@/features/data-management/components/RevertMetadataHistoryDialog'
import { RecordMetadataSection } from '@/features/data-management/components/RecordMetadataSection'
import type {
  ExportContext,
  ExportMode,
} from '@/features/data-management/lib/exportHelpers'
import { runExport } from '@/features/data-management/lib/exportHelpers'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { getPermissionsByRole } from '@/features/data-management/config/roleConfig'
import {
  canExportDossierMetadata,
  canManageDossierMetadata,
  canQcSubmitAtAssignedLevel,
} from '@/features/data-management/lib/dossierStatusHelpers'
import { coerceMetadataText } from '@/features/data-management/lib/metadataDate'
import {
  buildRejectFieldKey,
  findAllDocumentsForMetadataGroup,
  findAllMetadataGroupIndicesForDocument,
  findDocumentForMetadataGroup,
  getMetadataGroupDisplayName,
  handleMetadataFieldNavigationKeyDown,
  mergeMetadataFieldChanges,
  resolveDocumentOcrPdfUrl,
  resolveMetadataGroupSourceDocumentPath,
} from '@/features/data-management/lib/metadataHelpers'
import { buildPdfFieldHighlight } from '@/features/data-management/lib/bboxCoords'
import { mapMetadataHistoryToBatches } from '@/features/data-management/lib/metadataEditHistoryMapper'
import { resolveEditorPdfMaskEnabled } from '@/features/data-management/lib/pdfMaskPolicy'
import { useQcInlineReject } from '@/features/data-management/hooks/useQcInlineReject'
import { useEditorErrorReports } from '@/features/data-management/hooks/useEditorErrorReports'
import {
  getRejectedIssueReportFromClaim,
} from '@/features/data-management/lib/editorErrorReportHelpers'
import {
  dossierMetadataHistoryQueryOptions,
  useRestoreDossierMetadataHistoryMutation,
  useSaveDossierMetadataMutation,
} from '@/features/data-management/queries'
import { useSubmitEditorDraftFinalSaveItemsMutation } from '@/features/editor-dossiers/queries'
import type {
  DataDocumentFieldT,
  DataDossierMetadataT,
  DataDossierStatus,
  DataMetadataEditBatchT,
  DataMetadataEditFieldChangeT,
  DataTreeNodeT,
} from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'

function fieldToHighlight(
  field: DataDocumentFieldT,
  groupFields: Array<DataDocumentFieldT>,
): PdfFieldHighlight | null {
  return buildPdfFieldHighlight(field, groupFields)
}

export type EditorMetadataSaveMode = 'draft' | 'final' | 'error_report'

export function RecordDetailPanel({
  node,
  role,
  dossierId,
  dossierStatus,
  isEditorDraftView = false,
  focusDocumentId,
  focusGroupIndex,
  onFocusDocument,
  onWorkflowComplete,
}: {
  node: DataTreeNodeT
  role: string
  dossierId: string
  dossierStatus?: DataDossierStatus
  isEditorDraftView?: boolean
  focusDocumentId?: string
  focusGroupIndex?: number
  onFocusDocument?: (documentId: string, groupIndex: number) => void
  onWorkflowComplete?: (
    dossierId: string,
    mode?: EditorMetadataSaveMode,
  ) => void | Promise<void>
}) {
  const { t } = useTranslation('data-management')
  const managementRole = role as DataManagementRole
  const permissions = getPermissionsByRole(managementRole)
  const isEditorRole = managementRole === 'editor'
  const isEditorDraftDossier =
    isEditorDraftView ||
    node.assignmentStatus === 'DRAFT' ||
    dossierStatus === 'ENTRY_DRAFT'
  const qcRejectFieldKeys = useMemo(
    () => new Set(node.rejectFields ?? []),
    [node.id, node.rejectFields],
  )
  const [dismissedRejectFieldKeys, setDismissedRejectFieldKeys] = useState<
    Set<string>
  >(() => new Set())
  const canManage = canManageDossierMetadata({
    role: managementRole,
    dossierStatus,
    baseCanManage: permissions.canEditFileMetadataFields,
  })
  const effectiveDossierStatus = dossierStatus ?? node.dossierStatus
  const canShowSubmitButton =
    canManage &&
    (managementRole !== 'qc' ||
      canQcSubmitAtAssignedLevel({
        dossierStatus: effectiveDossierStatus,
        assignedCheckerLevel: node.assignedCheckerLevel,
      }))
  const canExport = canExportDossierMetadata(
    dossierStatus ?? node.dossierStatus,
  )
  const saveMutation = useSaveDossierMetadataMutation(managementRole)
  const finalSaveMutation = useSubmitEditorDraftFinalSaveItemsMutation()
  const restoreHistoryMutation = useRestoreDossierMetadataHistoryMutation()
  const isApproveRole = managementRole === 'admin' || managementRole === 'qc'
  const isQcRole = managementRole === 'qc'
  const isManagerRole = managementRole === 'manager'
  const canReviewErrorReports =
    isQcRole || isManagerRole || managementRole === 'admin'
  const editorErrorReports = useEditorErrorReports(managementRole, {
    dossierId,
    dossierName: node.name,
  })
  const [errorReportDialogOpen, setErrorReportDialogOpen] = useState(false)
  const [errorReportReviewOpen, setErrorReportReviewOpen] = useState(false)
  const pendingErrorReports = editorErrorReports.pendingReportsForDossier
  const errorReportsForReview = editorErrorReports.reportsForDossierReview
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
    isApproveRole && pendingErrorReportCount > 0

  useEffect(() => {
    if (pendingErrorReportCount === 0 && errorReportReviewOpen) {
      setErrorReportReviewOpen(false)
    }
  }, [pendingErrorReportCount, errorReportReviewOpen])
  const canViewEditHistory = permissions.canViewMetadataEditHistory
  const canEditFields = canManage

  const metadata = node.dossierMetadata
  const dossierContentKey = useMemo(
    () =>
      `${node.id}:${node.dossierMetadata?.ho_so_id ?? ''}:${node.dossierMetadata?.trang_thai_ho_so ?? ''}`,
    [
      node.id,
      node.dossierMetadata?.ho_so_id,
      node.dossierMetadata?.trang_thai_ho_so,
    ],
  )
  const [metadataState, setMetadataState] =
    useState<DataDossierMetadataT | null>(metadata ?? null)
  const activeMetadata = metadataState ?? metadata ?? null
  const documents = useMemo(
    () => node.children.filter((child) => child.type === 'document'),
    [node.children],
  )
  const groups = activeMetadata?.metadata_groups ?? []
  const dossierFolderHint = activeMetadata?.ho_so_id?.trim() || node.name
  const hasSummaryFields =
    Boolean(activeMetadata?.ho_so_id) ||
    Boolean(activeMetadata?.trang_thai_ho_so) ||
    (activeMetadata?.general_fields?.length ?? 0) > 0

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
    return groups.length > 0 ? 0 : -1
  }, [focusDocument, documentMatchingGroupIndices, groups.length])

  const [pdfHighlight, setPdfHighlight] = useState<PdfFieldHighlight | null>(
    null,
  )
  const defaultPdfMaskEnabled = useMemo(
    () => isEditorRole && resolveEditorPdfMaskEnabled(node),
    [isEditorRole, node],
  )
  const [isPdfMaskEnabled, setIsPdfMaskEnabled] = useState(defaultPdfMaskEnabled)
  const [useOriginalPdfFallback, setUseOriginalPdfFallback] = useState(false)
  const [highlightedFieldKey, setHighlightedFieldKey] = useState<string | null>(
    null,
  )
  const [highlightedChangeId, setHighlightedChangeId] = useState<string | null>(
    null,
  )
  const [detailTab, setDetailTab] = useState<'metadata' | 'editHistory'>(
    'metadata',
  )
  const qcReject = useQcInlineReject({
    dossierId,
    onSuccess: () => void onWorkflowComplete?.(dossierId),
  })
  const [restoringBatchId, setRestoringBatchId] = useState<string | null>(null)
  const [pendingRevertBatch, setPendingRevertBatch] =
    useState<DataMetadataEditBatchT | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportingMode, setExportingMode] = useState<ExportMode | null>(null)
  const groupCardRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const fieldInputRefs = useRef<
    Map<string, HTMLInputElement | HTMLTextAreaElement>
  >(new Map())
  const saveButtonRef = useRef<HTMLButtonElement | null>(null)
  const baseMetadataRef = useRef<DataDossierMetadataT | null>(null)
  const nodeRef = useRef(node)
  nodeRef.current = node
  const pendingFieldActivationRef = useRef<{
    fieldKey: string
    highlight: PdfFieldHighlight | null
    changeId?: string | null
  } | null>(null)
  const lastAppliedFocusRef = useRef<string | null>(null)

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
    const nextMetadata = currentNode.dossierMetadata ?? null
    setMetadataState(nextMetadata)
    baseMetadataRef.current =
      currentNode.fullDossierMetadata ?? nextMetadata ?? null
    setDetailTab('metadata')
    setDismissedRejectFieldKeys(new Set())
  }, [dossierContentKey])

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

  const editHistoryBatches = useMemo(() => {
    if (!canViewEditHistory || !activeMetadata || !editHistoryQuery.data) {
      return []
    }
    return mapMetadataHistoryToBatches(editHistoryQuery.data, activeMetadata)
  }, [canViewEditHistory, activeMetadata, editHistoryQuery.data])

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
      selectedDocument
        ? resolveDocumentOcrPdfUrl(selectedDocument)
        : undefined,
    [selectedDocument],
  )
  const originalPdfUrl = selectedDocument?.fileUrl?.trim() || undefined

  useEffect(() => {
    setUseOriginalPdfFallback(false)
  }, [selectedDocument?.id, ocrPdfUrl])

  const activePdfUrl = useMemo(() => {
    if (!selectedDocument) return undefined
    if (useOriginalPdfFallback && originalPdfUrl) return originalPdfUrl
    if (ocrPdfUrl) return ocrPdfUrl
    return originalPdfUrl
  }, [
    selectedDocument,
    useOriginalPdfFallback,
    ocrPdfUrl,
    originalPdfUrl,
  ])

  const isOcrPdfLayer = Boolean(
    activePdfUrl && ocrPdfUrl && activePdfUrl === ocrPdfUrl,
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

  function focusNextMetadataField(groupIndex: number, fieldIndex: number) {
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
        )
      }

      return
    }

    saveButtonRef.current?.focus()
  }

  function focusPreviousMetadataField(groupIndex: number, fieldIndex: number) {
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
        focusPrevious: () =>
          focusPreviousMetadataField(groupIndex, fieldIndex),
      },
      { isTextArea, alwaysNavigateOnEnter: true },
    )
  }

  function dismissEditorRejectField(groupCode: string, fieldName: string) {
    if (!isEditorRole) return
    const rejectKey = buildRejectFieldKey(groupCode, fieldName)
    if (!qcRejectFieldKeys.has(rejectKey)) return
    setDismissedRejectFieldKeys((prev) => {
      if (prev.has(rejectKey)) return prev
      const next = new Set(prev)
      next.add(rejectKey)
      return next
    })
  }

  function isEditorRejectHighlighted(
    groupCode: string,
    fieldName: string,
  ): boolean {
    if (!isEditorRole) return false
    const rejectKey = buildRejectFieldKey(groupCode, fieldName)
    return (
      qcRejectFieldKeys.has(rejectKey) &&
      !dismissedRejectFieldKeys.has(rejectKey)
    )
  }

  function handleFieldChange(
    targetGroupIndex: number,
    fieldIndex: number,
    value: string,
  ) {
    const field =
      activeMetadata?.metadata_groups[targetGroupIndex]?.fields[fieldIndex]
    const groupCode =
      activeMetadata?.metadata_groups[targetGroupIndex]?.group_code
    if (groupCode && field) {
      dismissEditorRejectField(groupCode, field.name)
    }

    setMetadataState((prev) => {
      if (!prev) return prev
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
      return { ...prev, metadata_groups: nextGroups }
    })
  }

  function handleMetadataFieldActivate(
    groupIndex: number,
    field: DataDocumentFieldT,
    fieldKey: string,
    changeId?: string | null,
  ) {
    const group = activeMetadata?.metadata_groups[groupIndex]
    if (!group) return

    const highlight = fieldToHighlight(field, group.fields)
    const linkedDocuments = findAllDocumentsForMetadataGroup(group, documents)

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
        onFocusDocument?.(targetDocument.id, groupIndex)
        return
      }
    }

    pendingFieldActivationRef.current = null
    setPdfHighlight(highlight)
    setHighlightedFieldKey(fieldKey)
    setHighlightedChangeId(changeId ?? null)
  }

  function handleHistoryFieldActivate(change: DataMetadataEditFieldChangeT) {
    const fieldKey = `${change.groupIndex}-${change.fieldName}-${change.fieldIndex}`
    handleMetadataFieldActivate(
      change.groupIndex,
      change.field,
      fieldKey,
      change.id,
    )
  }

  function handleRequestRevertHistoryBatch(batch: DataMetadataEditBatchT) {
    if (!dossierId.trim() || restoreHistoryMutation.isPending) return
    setPendingRevertBatch(batch)
  }

  async function handleConfirmRevertHistoryBatch() {
    if (!pendingRevertBatch || !dossierId.trim() || restoreHistoryMutation.isPending) {
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
    async (mode: ExportMode) => {
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
        })
        toast.success(t('recordDetail.exportExcelSuccess'))
        setExportDialogOpen(false)
      } catch {
        toast.error(t('recordDetail.exportExcelError'))
      } finally {
        setIsExporting(false)
        setExportingMode(null)
      }
    },
    [exportContext, isExporting, t],
  )

  async function handleSaveMetadata(mode: EditorMetadataSaveMode = 'draft') {
    if (!activeMetadata || !dossierId.trim()) return
    const baseMetadata = baseMetadataRef.current ?? activeMetadata
    const payload = mergeMetadataFieldChanges(baseMetadata, activeMetadata)
    try {
      if (isEditorRole && mode === 'final') {
        if (isEditorDraftDossier) {
          const result = await finalSaveMutation.mutateAsync([
            { dossierId, metadata: payload },
          ])
          if (result.failedCount > 0) {
            toast.error(t('metadata.finalSaveError'))
            return
          }
        } else {
          await saveMutation.mutateAsync({
            dossierId,
            metadata: payload,
            isDraft: false,
          })
        }
        baseMetadataRef.current = payload
        try {
          await onWorkflowComplete?.(dossierId, 'final')
        } catch {
          return
        }
        toast.success(t('metadata.finalSaveSuccess'))
        return
      }

      await saveMutation.mutateAsync({
        dossierId,
        metadata: payload,
        isDraft: isEditorRole && mode === 'draft',
      })
      baseMetadataRef.current = payload

      try {
        await onWorkflowComplete?.(dossierId, mode)
      } catch {
        return
      }

      if (isEditorRole && mode === 'draft') {
        toast.success(t('metadata.saveDraftSuccess'))
        return
      }

      toast.success(
        isApproveRole
          ? t('metadata.approveSuccess')
          : t('metadata.saveSuccess'),
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : mode === 'final'
            ? t('metadata.finalSaveError')
            : t('metadata.saveError')
      toast.error(message)
    }
  }

  if (!activeMetadata) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {t('recordDetail.loadingMetadata')}
      </p>
    )
  }

  const canShowDetailLayout =
    hasSummaryFields || groups.length > 0 || focusDocument != null

  if (!canShowDetailLayout) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {t('recordDetail.noFields')}
      </p>
    )
  }

  const isSaving =
    saveMutation.isPending ||
    finalSaveMutation.isPending ||
    qcReject.isRejectPending
  const isDraftSaving = saveMutation.isPending && !finalSaveMutation.isPending
  const isFinalSaving = finalSaveMutation.isPending

  function buildFieldRejectMark(groupCode: string, field: DataDocumentFieldT) {
    if (!isQcRole || !canShowSubmitButton) return undefined

    const rejectKey = buildRejectFieldKey(groupCode, field.name)
    return {
      id: `qc-reject-${rejectKey}`,
      checked: qcReject.rejectFieldKeys.has(rejectKey),
      onCheckedChange: (checked: boolean) =>
        qcReject.toggleRejectField(rejectKey, checked),
      disabled: isSaving,
    }
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

      {isEditorRole && node.lastRejectNotes?.trim() ? (
        <div className="shrink-0 rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-sm font-medium text-destructive">
            {t('metadata.editorReject.title')}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
            {node.lastRejectNotes.trim()}
          </p>
        </div>
      ) : null}

      {hasSummaryFields ? (
        <div className="shrink-0">
          <RecordMetadataSection metadata={activeMetadata} />
        </div>
      ) : null}

      {groups.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <h3 className="shrink-0 text-sm font-medium text-foreground">
            {t('recordDetail.documentsTitle')}
          </h3>
          {isQcRole && canShowSubmitButton ? (
            <p className="shrink-0 text-xs text-muted-foreground">
              {t('metadata.rejectInline.hint')}
            </p>
          ) : null}
          {isEditorRole && qcRejectFieldKeys.size > 0 ? (
            <p className="shrink-0 text-xs text-muted-foreground">
              {t('metadata.editorReject.fieldHint')}
            </p>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border">
            <div className="grid gap-3 p-3">
              {activeMetadata.metadata_groups.map((group, groupIndex) => {
                const groupPath = resolveMetadataGroupSourceDocumentPath(
                  group,
                  dossierFolderHint,
                )
                const linkedDocuments = findAllDocumentsForMetadataGroup(
                  group,
                  documents,
                )
                const isActiveGroup = groupIndex === selectedGroupIndex

                return (
                  <div
                    key={`${group.group_code}-${groupIndex}`}
                    ref={(element) => {
                      if (element) {
                        groupCardRefs.current.set(groupIndex, element)
                      } else {
                        groupCardRefs.current.delete(groupIndex)
                      }
                    }}
                    className={cn(
                      'space-y-2 rounded-md border p-3 transition-colors',
                      isActiveGroup
                        ? 'border-primary bg-accent/30'
                        : 'border-border',
                    )}
                  >
                    <button
                      type="button"
                      className={cn(
                        'text-left text-sm font-medium',
                        linkedDocuments.length > 0
                          ? 'cursor-pointer text-foreground hover:underline'
                          : 'cursor-default text-muted-foreground',
                        isActiveGroup &&
                          linkedDocuments.length > 0 &&
                          'text-primary',
                      )}
                      onClick={() => handleGroupTitleClick(groupIndex)}
                      disabled={linkedDocuments.length === 0}
                      aria-label={t('recordDetail.openPdf')}
                      aria-current={isActiveGroup ? 'true' : undefined}
                    >
                      {getMetadataGroupDisplayName(group) ||
                        t('recordDetail.unknownFile')}
                    </button>
                    {groupPath ? (
                      <p className="text-xs text-muted-foreground">
                        {groupPath}
                      </p>
                    ) : null}
                    <div className="grid gap-2">
                      {group.fields.length > 0 ? (
                        group.fields.map((field, fieldIndex) => {
                          const fieldKey = `${groupIndex}-${field.name}-${fieldIndex}`

                          return !canEditFields || field.type === 'string' ? (
                            <MetadataFieldRow
                              key={`${group.group_code}-${field.name}-${fieldIndex}`}
                              field={field}
                              value={coerceMetadataText(field.value)}
                              disabled={!canEditFields || isSaving}
                              editDisplay={false}
                              onValueChange={(value) =>
                                handleFieldChange(groupIndex, fieldIndex, value)
                              }
                              onHighlight={() =>
                                handleMetadataFieldActivate(
                                  groupIndex,
                                  field,
                                  fieldKey,
                                )
                              }
                              isHighlighted={highlightedFieldKey === fieldKey}
                              index={fieldIndex}
                              onKeyDown={
                                canEditFields
                                  ? (event) =>
                                      handleMetadataFieldKeyDown(
                                        event,
                                        groupIndex,
                                        fieldIndex,
                                      )
                                  : undefined
                              }
                              fieldRef={(element) => {
                                const refKey = `${groupIndex}-${fieldIndex}`
                                if (
                                  element instanceof HTMLInputElement ||
                                  element instanceof HTMLTextAreaElement
                                ) {
                                  fieldInputRefs.current.set(refKey, element)
                                } else {
                                  fieldInputRefs.current.delete(refKey)
                                }
                              }}
                              rejectMark={buildFieldRejectMark(
                                group.group_code,
                                field,
                              )}
                              isQcRejectedHighlight={isEditorRejectHighlighted(
                                group.group_code,
                                field.name,
                              )}
                            />
                          ) : (
                            <MetadataFieldInput
                              key={`${group.group_code}-${field.name}-${fieldIndex}`}
                              field={field}
                              value={coerceMetadataText(field.value)}
                              onChange={(value) =>
                                handleFieldChange(groupIndex, fieldIndex, value)
                              }
                              onHighlight={() =>
                                handleMetadataFieldActivate(
                                  groupIndex,
                                  field,
                                  fieldKey,
                                )
                              }
                              isHighlighted={highlightedFieldKey === fieldKey}
                              index={fieldIndex}
                              idPrefix={`record-metadata-${groupIndex}`}
                              disabled={!canEditFields || isSaving}
                              onKeyDown={(event, _index, isTextArea) =>
                                handleMetadataFieldKeyDown(
                                  event,
                                  groupIndex,
                                  fieldIndex,
                                  isTextArea,
                                )
                              }
                              fieldRef={(element) => {
                                const refKey = `${groupIndex}-${fieldIndex}`
                                if (
                                  element instanceof HTMLInputElement ||
                                  element instanceof HTMLTextAreaElement
                                ) {
                                  fieldInputRefs.current.set(refKey, element)
                                } else {
                                  fieldInputRefs.current.delete(refKey)
                                }
                              }}
                              rejectMark={buildFieldRejectMark(
                                group.group_code,
                                field,
                              )}
                              isQcRejectedHighlight={isEditorRejectHighlighted(
                                group.group_code,
                                field.name,
                              )}
                            />
                          )
                        })
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {t('recordDetail.noFields')}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
              {activeMetadata.metadata_groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('recordDetail.noFields')}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {canShowSubmitButton && isQcRole && qcReject.isRejectMode ? (
        <QcInlineRejectBar
          selectedCount={qcReject.rejectFieldKeys.size}
          notes={qcReject.rejectNotes}
          onNotesChange={qcReject.setRejectNotes}
          onClear={qcReject.clearRejectSelection}
          onSubmit={qcReject.submitReject}
          isPending={qcReject.isRejectPending}
        />
      ) : canShowSubmitButton || canExport || isEditorRole ? (
        <div className="flex shrink-0 justify-end gap-2 border-t border-border pt-2">
          {isEditorRole ? (
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              onClick={() => setErrorReportDialogOpen(true)}
              disabled={!canSubmitErrorReport || !activeMetadata}
            >
              <AlertTriangle className="size-4" aria-hidden />
              {t('editorErrorReport.actions.report')}
            </Button>
          ) : null}
          {canExport ? (
            <Button
              type="button"
              className="gap-2"
              onClick={() => setExportDialogOpen(true)}
            >
              <FileDown className="size-4" aria-hidden />
              {t('recordDetail.exportExcel')}
            </Button>
          ) : canShowSubmitButton ? (
            isEditorRole ? (
              <>
                {!isEditorDraftDossier ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => void handleSaveMetadata('draft')}
                    disabled={isSaving}
                  >
                    {isDraftSaving ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Save className="size-4" aria-hidden />
                    )}
                    {isDraftSaving
                      ? t('metadata.savingDraft')
                      : t('metadata.saveDraft')}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  className="gap-2"
                  onClick={() => void handleSaveMetadata('final')}
                  disabled={isSaving}
                  ref={saveButtonRef}
                >
                  {isFinalSaving ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Save className="size-4" aria-hidden />
                  )}
                  {isFinalSaving
                    ? t('metadata.submittingFinal')
                    : t('metadata.finalSave')}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                className="gap-2"
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
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="size-4" aria-hidden />
                )}
                {isSaving
                  ? isApproveRole
                    ? t('metadata.approving')
                    : t('metadata.saving')
                  : isApproveRole
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-3 overflow-hidden border-border p-2 lg:border-r">
          {canViewEditHistory ? (
            <Tabs
              value={detailTab}
              onValueChange={handleDetailTabChange}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <TabsList className="grid w-full shrink-0 grid-cols-2">
                <TabsTrigger value="metadata">
                  {t('recordDetail.tabs.metadata')}
                </TabsTrigger>
                <TabsTrigger value="editHistory">
                  {t('recordDetail.tabs.editHistory')}
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="metadata"
                className="mt-2 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
              >
                {metadataPanelContent}
              </TabsContent>
              <TabsContent
                value="editHistory"
                className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden"
              >
                <RecordMetadataEditHistorySection
                  batches={editHistoryBatches}
                  highlightedChangeId={highlightedChangeId}
                  isLoading={editHistoryQuery.isLoading}
                  isError={editHistoryQuery.isError}
                  isRestoring={restoreHistoryMutation.isPending}
                  restoringBatchId={restoringBatchId}
                  onFieldActivate={handleHistoryFieldActivate}
                  onRevertBatch={handleRequestRevertHistoryBatch}
                />
              </TabsContent>
            </Tabs>
          ) : (
            metadataPanelContent
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
          {activePdfUrl ? (
            <PdfViewer
              key={`${selectedDocument?.id ?? 'none'}-${isOcrPdfLayer ? 'ocr' : 'original'}`}
              fileUrl={activePdfUrl}
              fileName={selectedDocument?.name}
              className="min-h-0 flex-1"
              showBorder={false}
              highlight={pdfHighlight}
              maskMode={isEditorRole && isPdfMaskEnabled ? 'bbox-only' : 'off'}
              revealRegions={pdfRevealRegions}
              renderTextLayer={isOcrPdfLayer}
              renderAnnotationLayer={isOcrPdfLayer}
              restrictTextCopyToRevealRegions={
                isEditorRole && isPdfMaskEnabled && isOcrPdfLayer
              }
              onLoadFailed={
                isOcrPdfLayer && originalPdfUrl
                  ? handleOcrPdfLoadFailed
                  : undefined
              }
            />
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
        }}
      />
    </div>
  )
}
