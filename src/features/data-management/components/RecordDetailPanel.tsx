import { Loader2, Save, XCircle } from 'lucide-react'
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
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { getPermissionsByRole } from '@/features/data-management/config/roleConfig'
import { canManageDossierMetadata } from '@/features/data-management/lib/dossierStatusHelpers'
import { coerceMetadataText } from '@/features/data-management/lib/metadataDate'
import {
  findAllDocumentsForMetadataGroup,
  findDocumentForMetadataGroup,
  findMetadataGroupIndexForDocument,
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
  if (field.bbox.length !== 4 || field.page < 1) return null
  return {
    page: field.page,
    bbox: field.bbox as [number, number, number, number],
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
  onWorkflowComplete?: (dossierId: string) => void
}) {
  const { t } = useTranslation('data-management')
  const managementRole = role as DataManagementRole
  const permissions = getPermissionsByRole(managementRole)
  const canManage = canManageDossierMetadata({
    role: managementRole,
    dossierStatus,
    baseCanManage: permissions.canEditFileMetadataFields,
  })
  const saveMutation = useSaveDossierMetadataMutation(managementRole)
  const isApproveRole = managementRole === 'admin' || managementRole === 'qc'
  const isQcRole = managementRole === 'qc'

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

  const initialGroupIndex = useMemo(() => {
    if (focusDocument && groups.length > 0) {
      return findMetadataGroupIndexForDocument(
        groups,
        focusDocument,
        documents,
      )
    }
    return 0
  }, [focusDocument, groups, documents])

  const [metadataState, setMetadataState] = useState<DataDossierMetadataT | null>(
    metadata ?? null,
  )
  const [pdfHighlight, setPdfHighlight] = useState<PdfFieldHighlight | null>(null)
  const [highlightedFieldKey, setHighlightedFieldKey] = useState<string | null>(
    null,
  )
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const groupCardRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const fieldInputRefs = useRef<
    Map<string, HTMLInputElement | HTMLTextAreaElement>
  >(new Map())
  const saveButtonRef = useRef<HTMLButtonElement | null>(null)

  const editableFieldKeys = useMemo(() => {
    if (!metadataState || !canManage) return [] as Array<string>
    const keys: Array<string> = []
    metadataState.metadata_groups.forEach((group, groupIndex) => {
      group.fields.forEach((_field, fieldIndex) => {
        keys.push(`${groupIndex}-${fieldIndex}`)
      })
    })
    return keys
  }, [metadataState, canManage])

  useEffect(() => {
    setMetadataState(metadata ?? null)
    setPdfHighlight(null)
    setHighlightedFieldKey(null)
  }, [metadata, node.id, initialGroupIndex])

  const selectedGroupIndex = useMemo(() => {
    if (
      focusGroupIndex != null &&
      focusGroupIndex >= 0 &&
      focusGroupIndex < groups.length
    ) {
      return focusGroupIndex
    }
    if (focusDocument && groups.length > 0) {
      return findMetadataGroupIndexForDocument(groups, focusDocument, documents)
    }
    return initialGroupIndex
  }, [documents, focusDocument, focusGroupIndex, groups, initialGroupIndex])

  const selectedGroup = metadataState?.metadata_groups[selectedGroupIndex]

  const selectedDocument = useMemo(() => {
    if (!selectedGroup) return focusDocument ?? null
    return (
      findDocumentForMetadataGroup(selectedGroup, documents) ??
      focusDocument ??
      null
    )
  }, [selectedGroup, documents, focusDocument])

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
      if (fieldInputRefs.current.has(nextKey)) {
        focusMetadataField(nextKey)
        return
      }
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
      !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
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

  function handleFieldHighlight(field: DataDocumentFieldT, fieldKey: string) {
    const next = fieldToHighlight(field)
    if (!next) return
    setPdfHighlight(next)
    setHighlightedFieldKey(fieldKey)
  }

  async function handleSaveMetadata() {
    if (!metadataState || !dossierId.trim()) return
    try {
      await saveMutation.mutateAsync({ dossierId, metadata: metadataState })
      toast.success(
        isApproveRole ? t('metadata.approveSuccess') : t('metadata.saveSuccess'),
      )
      onWorkflowComplete?.(dossierId)
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

  if (groups.length === 0 && !hasSummaryFields) {
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

                              return !canManage || field.type === 'string' ? (
                                <MetadataFieldRow
                                  key={`${group.group_code}-${field.name}-${fieldIndex}`}
                                  field={field}
                                  value={coerceMetadataText(field.value)}
                                  disabled={!canManage || isSaving}
                                  editDisplay={false}
                                  onValueChange={(value) =>
                                    handleFieldChange(groupIndex, field.name, value)
                                  }
                                  onHighlight={(value) =>
                                    handleFieldHighlight(value, fieldKey)
                                  }
                                  isHighlighted={highlightedFieldKey === fieldKey}
                                  index={fieldIndex}
                                  onKeyDown={
                                    canManage
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
                                />
                              ) : (
                                <MetadataFieldInput
                                  key={`${group.group_code}-${field.name}-${fieldIndex}`}
                                  field={field}
                                  value={coerceMetadataText(field.value)}
                                  onChange={(value) =>
                                    handleFieldChange(groupIndex, field.name, value)
                                  }
                                  onHighlight={(value) =>
                                    handleFieldHighlight(value, fieldKey)
                                  }
                                  isHighlighted={highlightedFieldKey === fieldKey}
                                  index={fieldIndex}
                                  idPrefix={`record-metadata-${groupIndex}`}
                                  disabled={isSaving}
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

          {canManage ? (
            <div className="flex shrink-0 justify-end gap-2 border-t border-border pt-2">
              {isQcRole ? (
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
          onSuccess={() => onWorkflowComplete?.(dossierId)}
        />
      ) : null}
    </div>
  )
}
