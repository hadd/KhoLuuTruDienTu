import { FileDown, Loader2, Save, XCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PdfViewer } from '@/components/common/PdfViewer'
import type { PdfFieldHighlight } from '@/components/common/PdfViewer'
import { Button } from '@/components/ui/button'
import { DocumentRejectDialog } from '@/features/data-management/components/DocumentRejectDialog'
import { MetadataFieldInput } from '@/features/data-management/components/MetadataFieldInput'
import { MetadataFieldRow } from '@/features/data-management/components/MetadataFieldRow'
import { RecordMetadataSection } from '@/features/data-management/components/RecordMetadataSection'
import { exportDossierMetadataExcel } from '@/features/data-management/api/dossierClient'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { getPermissionsByRole } from '@/features/data-management/config/roleConfig'
import {
  canExportDossierMetadata,
  canManageDossierMetadata,
} from '@/features/data-management/lib/dossierStatusHelpers'
import { coerceMetadataText } from '@/features/data-management/lib/metadataDate'
import {
  findAllDocumentsForMetadataGroup,
  findAllMetadataGroupIndicesForDocument,
  findDocumentForMetadataGroup,
  getMetadataGroupDisplayName,
  isFieldCaretAtEnd,
  resolveMetadataGroupSourceDocumentPath,
} from '@/features/data-management/lib/metadataHelpers'
import { useSaveDossierMetadataMutation } from '@/features/data-management/queries'
import type {
  DataDocumentFieldT,
  DataDossierMetadataT,
  DataDossierStatus,
  DataTreeNodeT,
} from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'

function fieldToHighlight(field: DataDocumentFieldT): PdfFieldHighlight | null {
  if (field.page < 1 || field.bboxes.length === 0) return null
  return {
    page: field.page,
    bboxes: field.bboxes,
  }
}

export function RecordDetailPanel({
  node,
  role,
  dossierId,
  dossierStatus,
  focusDocumentId,
  focusGroupIndex,
  onFocusDocument,
  onWorkflowComplete,
}: {
  node: DataTreeNodeT
  role: string
  dossierId: string
  dossierStatus?: DataDossierStatus
  focusDocumentId?: string
  focusGroupIndex?: number
  onFocusDocument?: (documentId: string, groupIndex: number) => void
  onWorkflowComplete?: (dossierId: string) => void | Promise<void>
}) {
  const { t } = useTranslation('data-management')
  const managementRole = role as DataManagementRole
  const permissions = getPermissionsByRole(managementRole)
  const canManage = canManageDossierMetadata({
    role: managementRole,
    dossierStatus,
    baseCanManage: permissions.canEditFileMetadataFields,
  })
  const canExport = canExportDossierMetadata(dossierStatus)
  const saveMutation = useSaveDossierMetadataMutation(managementRole)
  const isApproveRole = managementRole === 'admin' || managementRole === 'qc'
  const isQcRole = managementRole === 'qc'
  const canEditFields = canManage

  const metadata = node.dossierMetadata
  const documents = useMemo(
    () => node.children.filter((child) => child.type === 'document'),
    [node.children],
  )
  const groups = metadata?.metadata_groups ?? []
  const dossierFolderHint = metadata?.ho_so_id?.trim() || node.name
  const hasSummaryFields =
    Boolean(metadata?.ho_so_id) ||
    Boolean(metadata?.trang_thai_ho_so) ||
    (metadata?.general_fields?.length ?? 0) > 0

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

  const [metadataState, setMetadataState] =
    useState<DataDossierMetadataT | null>(metadata ?? null)
  const [pdfHighlight, setPdfHighlight] = useState<PdfFieldHighlight | null>(
    null,
  )
  const [highlightedFieldKey, setHighlightedFieldKey] = useState<string | null>(
    null,
  )
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const groupCardRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const fieldInputRefs = useRef<
    Map<string, HTMLInputElement | HTMLTextAreaElement>
  >(new Map())
  const saveButtonRef = useRef<HTMLButtonElement | null>(null)
  const pendingFieldActivationRef = useRef<{
    fieldKey: string
    highlight: PdfFieldHighlight | null
  } | null>(null)
  const lastAppliedFocusRef = useRef<string | null>(null)

  function focusActivationKey(
    documentId?: string,
    groupIndex?: number,
  ): string {
    return `${documentId ?? ''}:${groupIndex ?? ''}`
  }

  const editableFieldKeys = useMemo(() => {
    if (!metadataState || !canEditFields) return [] as Array<string>
    const keys: Array<string> = []
    metadataState.metadata_groups.forEach((group, groupIndex) => {
      group.fields.forEach((_field, fieldIndex) => {
        keys.push(`${groupIndex}-${fieldIndex}`)
      })
    })
    return keys
  }, [metadataState, canEditFields])

  useEffect(() => {
    const currentFocusKey = focusActivationKey(focusDocumentId, focusGroupIndex)
    const pending = pendingFieldActivationRef.current

    if (pending) {
      pendingFieldActivationRef.current = null
      setPdfHighlight(pending.highlight)
      setHighlightedFieldKey(pending.fieldKey)
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
    setMetadataState(metadata ?? null)
    setPdfHighlight(null)
    setHighlightedFieldKey(null)
  }, [metadata, node.id, initialGroupIndex])

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
      ? metadataState?.metadata_groups[selectedGroupIndex]
      : undefined

  const selectedDocument = useMemo(() => {
    if (focusDocument) return focusDocument

    if (selectedGroup) {
      return findDocumentForMetadataGroup(selectedGroup, documents) ?? null
    }

    return null
  }, [focusDocument, selectedGroup, documents])

  useEffect(() => {
    const card = groupCardRefs.current.get(selectedGroupIndex)
    card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedGroupIndex, focusDocumentId])

  function handleGroupTitleClick(groupIndex: number) {
    const group = metadataState?.metadata_groups[groupIndex]
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
        metadataState?.metadata_groups[nextGroupIndex]?.fields[nextFieldIndex]
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

  function handleMetadataFieldKeyDown(
    event: KeyboardEvent<HTMLElement>,
    groupIndex: number,
    fieldIndex: number,
    isTextArea: boolean = false,
  ) {
    const target = event.currentTarget
    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      )
    ) {
      return
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      if (isTextArea) return
      event.preventDefault()
      focusNextMetadataField(groupIndex, fieldIndex)
      return
    }

    if (event.key === 'Enter' && event.shiftKey && isTextArea) {
      event.preventDefault()
      focusNextMetadataField(groupIndex, fieldIndex)
      return
    }

    if (event.key === 'ArrowDown') {
      if (!isFieldCaretAtEnd(target)) return
      event.preventDefault()
      focusNextMetadataField(groupIndex, fieldIndex)
    }
  }

  function handleFieldChange(
    targetGroupIndex: number,
    fieldName: string,
    value: string,
  ) {
    setMetadataState((prev) => {
      if (!prev) return prev
      const nextGroups = prev.metadata_groups.map((group, groupIndex) => {
        if (groupIndex !== targetGroupIndex) return group
        return {
          ...group,
          fields: group.fields.map((field) =>
            field.name === fieldName ? { ...field, value } : field,
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
  ) {
    const group = metadataState?.metadata_groups[groupIndex]
    if (!group) return

    const highlight = fieldToHighlight(field)
    const linkedDocuments = findAllDocumentsForMetadataGroup(group, documents)

    if (linkedDocuments.length > 0) {
      const targetDocument = linkedDocuments[0]
      const needsFocusChange =
        targetDocument.id !== focusDocumentId ||
        groupIndex !== selectedGroupIndex

      if (needsFocusChange) {
        pendingFieldActivationRef.current = { fieldKey, highlight }
        onFocusDocument?.(targetDocument.id, groupIndex)
        return
      }
    }

    pendingFieldActivationRef.current = null
    setPdfHighlight(highlight)
    setHighlightedFieldKey(fieldKey)
  }

  async function handleExportDossier() {
    if (!canExport || !dossierId.trim() || isExporting) return

    setIsExporting(true)
    try {
      await exportDossierMetadataExcel(
        dossierId,
        metadataState?.ho_so_id?.trim() || undefined,
      )
      toast.success(t('recordDetail.exportExcelSuccess'))
    } catch {
      toast.error(t('recordDetail.exportExcelError'))
    } finally {
      setIsExporting(false)
    }
  }

  async function handleSaveMetadata() {
    if (!metadataState || !dossierId.trim()) return
    try {
      await saveMutation.mutateAsync({ dossierId, metadata: metadataState })
      try {
        await onWorkflowComplete?.(dossierId)
      } catch {
        return
      }
      toast.success(
        isApproveRole
          ? t('metadata.approveSuccess')
          : t('metadata.saveSuccess'),
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('metadata.saveError')
      toast.error(message)
    }
  }

  if (!metadata || !metadataState) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {t('detail.emptySelection')}
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

  const isSaving = saveMutation.isPending

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-3 overflow-hidden border-border p-2 lg:border-r">
          {hasSummaryFields ? (
            <div className="shrink-0">
              <RecordMetadataSection metadata={metadataState} />
            </div>
          ) : null}

          {groups.length > 0 ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
              <h3 className="shrink-0 text-sm font-medium text-foreground">
                {t('recordDetail.documentsTitle')}
              </h3>
              <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border">
                <div className="grid gap-3 p-3">
                  {metadataState.metadata_groups.map((group, groupIndex) => {
                    const groupPath = resolveMetadataGroupSourceDocumentPath(
                      group,
                      dossierFolderHint,
                    )
                    const linkedDocuments = findAllDocumentsForMetadataGroup(
                      group,
                      documents,
                    )
                    const linkedDocument = linkedDocuments[0]
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

                              return !canEditFields ||
                                field.type === 'string' ? (
                                <MetadataFieldRow
                                  key={`${group.group_code}-${field.name}-${fieldIndex}`}
                                  field={field}
                                  value={coerceMetadataText(field.value)}
                                  disabled={!canEditFields || isSaving}
                                  editDisplay={false}
                                  onValueChange={(value) =>
                                    handleFieldChange(
                                      groupIndex,
                                      field.name,
                                      value,
                                    )
                                  }
                                  onHighlight={() =>
                                    handleMetadataFieldActivate(
                                      groupIndex,
                                      field,
                                      fieldKey,
                                    )
                                  }
                                  isHighlighted={
                                    highlightedFieldKey === fieldKey
                                  }
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
                                      fieldInputRefs.current.set(
                                        refKey,
                                        element,
                                      )
                                    } else {
                                      fieldInputRefs.current.delete(refKey)
                                    }
                                  }}
                                />
                              ) : (
                                <MetadataFieldInput
                                  key={`${group.group_code}-${field.name}-${fieldIndex}`}
                                  field={field}
                                  value={coerceMetadataText(field.value)}
                                  onChange={(value) =>
                                    handleFieldChange(
                                      groupIndex,
                                      field.name,
                                      value,
                                    )
                                  }
                                  onHighlight={() =>
                                    handleMetadataFieldActivate(
                                      groupIndex,
                                      field,
                                      fieldKey,
                                    )
                                  }
                                  isHighlighted={
                                    highlightedFieldKey === fieldKey
                                  }
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
                                      fieldInputRefs.current.set(
                                        refKey,
                                        element,
                                      )
                                    } else {
                                      fieldInputRefs.current.delete(refKey)
                                    }
                                  }}
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
                  {metadataState.metadata_groups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t('recordDetail.noFields')}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {canManage || canExport ? (
            <div className="flex shrink-0 justify-end gap-2 border-t border-border pt-2">
              {canManage && isQcRole ? (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 text-destructive hover:text-destructive"
                  onClick={() => setRejectDialogOpen(true)}
                  disabled={isSaving}
                >
                  <XCircle className="size-4" aria-hidden />
                  {t('metadata.reject')}
                </Button>
              ) : null}
              {canExport ? (
                <Button
                  type="button"
                  className="gap-2"
                  onClick={() => void handleExportDossier()}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <FileDown className="size-4" aria-hidden />
                  )}
                  {isExporting
                    ? t('recordDetail.exportExcelExporting')
                    : t('recordDetail.exportExcel')}
                </Button>
              ) : canManage ? (
                <Button
                  type="button"
                  className="gap-2"
                  onClick={() => void handleSaveMetadata()}
                  disabled={isSaving}
                  ref={saveButtonRef}
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
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden p-2">
          {selectedDocument?.fileUrl ? (
            <PdfViewer
              fileUrl={selectedDocument.fileUrl}
              fileName={selectedDocument.name}
              className="h-full min-h-0"
              showBorder={false}
              highlight={pdfHighlight}
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

      {isQcRole && canManage ? (
        <DocumentRejectDialog
          open={rejectDialogOpen}
          onOpenChange={setRejectDialogOpen}
          dossierId={dossierId}
          onSuccess={() => void onWorkflowComplete?.(dossierId)}
        />
      ) : null}
    </div>
  )
}
