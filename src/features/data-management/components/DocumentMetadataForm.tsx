import { Check, Loader2, Save } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { MetadataFieldEditorRow } from '@/features/data-management/components/MetadataFieldStructurePanel'
import { MetadataFieldInput } from '@/features/data-management/components/MetadataFieldInput'
import { MetadataFieldRow } from '@/features/data-management/components/MetadataFieldRow'
import { QcInlineRejectBar } from '@/features/data-management/components/QcInlineRejectBar'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { getPermissionsByRole } from '@/features/data-management/config/roleConfig'
import { canManageDossierMetadata } from '@/features/data-management/lib/dossierStatusHelpers'
import {
  buildMetadataFieldValues,
  coerceMetadataText,
} from '@/features/data-management/lib/metadataDate'
import {
  applyDocumentFieldsToDossierMetadata,
  buildDefaultDossierMetadata,
  buildRejectFieldKey,
  createDraftCustomField,
  isDraftCustomField,
  isPdfDocumentRef,
  isFieldCaretAtEnd,
  mergeFormValuesIntoFields,
  normalizeSavedCustomFields,
  resolveGroupCodeForDocument,
} from '@/features/data-management/lib/metadataHelpers'
import { useQcInlineReject } from '@/features/data-management/hooks/useQcInlineReject'
import { updateDossierMetadataInTree } from '@/features/data-management/lib/treeUtils'
import {
  dataManagementTreeQueryKey,
  useClaimNextMakerAssignmentMutation,
  useRefreshDataManagementTreeMutation,
  useSaveDossierMetadataMutation,
} from '@/features/data-management/queries'
import { isNoAssignedDossierError } from '@/features/data-management/lib/loadErrors'
import type {
  DataDocumentFieldT,
  DataDossierMetadataT,
  DataDossierStatus,
  DataTreeNodeT,
} from '@/features/data-management/types'

export function DocumentMetadataForm({
  dossierId,
  dossierMetadata,
  documentName,
  documentFileRef,
  fields: initialFields,
  role,
  dossierStatus,
  isLastDocument = false,
  onAdvance,
  onWorkflowComplete,
  onFieldHighlight,
  highlightedFieldName,
}: {
  dossierId: string
  dossierMetadata?: DataDossierMetadataT
  documentName: string
  documentFileRef: string
  fields: Array<DataDocumentFieldT>
  role: string
  dossierStatus?: DataDossierStatus
  isLastDocument?: boolean
  onAdvance?: () => void
  onWorkflowComplete?: () => void
  onFieldHighlight?: (field: DataDocumentFieldT) => void
  highlightedFieldName?: string | null
}) {
  const { t } = useTranslation('data-management')
  const permissions = getPermissionsByRole(role as DataManagementRole)
  const canManage = canManageDossierMetadata({
    role: role as DataManagementRole,
    dossierStatus,
    baseCanManage: permissions.canEditFileMetadataFields,
  })
  const queryClient = useQueryClient()
  const saveMutation = useSaveDossierMetadataMutation(
    role as DataManagementRole,
  )
  const claimNextMutation = useClaimNextMakerAssignmentMutation()
  const refreshTreeMutation = useRefreshDataManagementTreeMutation(
    role as DataManagementRole,
  )
  const qcReject = useQcInlineReject({
    dossierId,
    onSuccess: () => finishQcWorkflow(),
  })
  const isPdfDocument = isPdfDocumentRef(documentFileRef, documentName)
  const isQcComplete = role === 'qc' && isLastDocument
  const isEditorComplete = role === 'editor' && isLastDocument && isPdfDocument
  const shouldPersistMetadata =
    role === 'editor' ? isEditorComplete : role === 'qc' ? isQcComplete : true
  const [fields, setFields] = useState(initialFields)
  const [values, setValues] = useState<Record<string, string>>(() =>
    buildMetadataFieldValues(initialFields),
  )
  const fieldRefs = useRef<Array<HTMLElement | null>>([])
  const saveButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    setFields(initialFields)
    setValues(buildMetadataFieldValues(initialFields))
  }, [initialFields])

  function handleChange(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  function handleAddField() {
    const nextField = createDraftCustomField(fields.length)
    setFields((prev) => [...prev, nextField])
    setValues((prev) => ({ ...prev, [nextField.name]: '' }))
  }

  function handleDeleteField(name: string) {
    setFields((prev) => prev.filter((field) => field.name !== name))
    setValues((prev) => {
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  function buildUpdatedFields() {
    return normalizeSavedCustomFields(mergeFormValuesIntoFields(fields, values))
  }

  function buildUpdatedMetadata(): DataDossierMetadataT {
    const updatedFields = buildUpdatedFields()
    const fileRef = documentFileRef || documentName
    const baseMetadata =
      dossierMetadata ?? buildDefaultDossierMetadata(fileRef, updatedFields)
    return applyDocumentFieldsToDossierMetadata(
      baseMetadata,
      fileRef,
      updatedFields,
    )
  }

  const rejectDossierMetadata = useMemo(
    () => buildUpdatedMetadata(),
    [fields, values, dossierMetadata, documentFileRef, documentName],
  )

  const documentGroupCode = useMemo(() => {
    const fileRef = documentFileRef || documentName
    return resolveGroupCodeForDocument(
      rejectDossierMetadata,
      fileRef,
      fields.map((field) => field.name),
    )
  }, [rejectDossierMetadata, documentFileRef, documentName, fields])

  function syncMetadataToTree(metadata: DataDossierMetadataT) {
    queryClient.setQueryData<DataTreeNodeT>(
      dataManagementTreeQueryKey(role as DataManagementRole),
      (currentTree) => {
        if (!currentTree) return currentTree
        return updateDossierMetadataInTree(currentTree, dossierId, metadata)
      },
    )
  }

  async function finishQcWorkflow() {
    await refreshTreeMutation.mutateAsync(undefined)
    onWorkflowComplete?.()
  }

  async function handleSaveValues() {
    try {
      const updatedFields = buildUpdatedFields()
      const metadata = buildUpdatedMetadata()

      if (shouldPersistMetadata) {
        await saveMutation.mutateAsync({ dossierId, metadata })
      } else {
        syncMetadataToTree(metadata)
      }

      setFields(updatedFields)
      setValues(buildMetadataFieldValues(updatedFields))

      if (isEditorComplete) {
        await claimNextMutation.mutateAsync()
        toast.success(t('metadata.completeSuccess'))
        return
      }

      if (isQcComplete) {
        toast.success(t('metadata.approveSuccess'))
        await finishQcWorkflow()
        return
      }

      toast.success(t('metadata.saveSuccess'))
      if (!isLastDocument) {
        onAdvance?.()
      }
    } catch (error) {
      if (isNoAssignedDossierError(error)) {
        return
      }
      const message =
        error instanceof Error ? error.message : t('metadata.saveError')
      toast.error(message)
    }
  }

  function focusField(index: number) {
    const target = fieldRefs.current[index] as
      | HTMLTextAreaElement
      | HTMLInputElement
    if (!target) return
    target.focus()
    try {
      if (target instanceof HTMLTextAreaElement || target.type === 'text') {
        const end = target.value.length
        target.setSelectionRange(end, end)
      }
    } catch {
      // ignore
    }
  }

  function focusNext(index: number) {
    for (let nextIndex = index + 1; nextIndex < fields.length; nextIndex++) {
      if (fieldRefs.current[nextIndex]) {
        focusField(nextIndex)
        const nextField = fields[nextIndex]
        if (nextField && onFieldHighlight) {
          onFieldHighlight(nextField)
        }
        return
      }
    }
    saveButtonRef.current?.focus()
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLElement>,
    index: number,
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
      focusNext(index)
      return
    }

    if (event.key === 'Enter' && event.shiftKey && isTextArea) {
      event.preventDefault()
      focusNext(index)
      return
    }

    if (event.key === 'ArrowDown') {
      if (!isFieldCaretAtEnd(target)) return
      event.preventDefault()
      focusNext(index)
      return
    }

    if (isTextArea && event.key === 'ArrowUp') {
      if (target.selectionStart !== 0 || target.selectionEnd !== 0) return
      event.preventDefault()
      focusField(Math.max(index - 1, 0))
    }
  }

  const isSaving =
    saveMutation.isPending ||
    claimNextMutation.isPending ||
    refreshTreeMutation.isPending ||
    qcReject.isRejectPending
  const isQcRole = role === 'qc'
  const isCompleteAction = isQcComplete || isEditorComplete
  const actionLabel = isCompleteAction
    ? t('metadata.complete')
    : role === 'qc'
      ? t('metadata.approve')
      : t('metadata.save')
  const ActionIcon = isCompleteAction ? Check : Save

  function buildFieldRejectMark(field: DataDocumentFieldT) {
    if (!isQcRole || !canManage || !documentGroupCode) return undefined

    const rejectKey = buildRejectFieldKey(documentGroupCode, field.name)
    return {
      id: `qc-reject-${rejectKey}`,
      checked: qcReject.rejectFieldKeys.has(rejectKey),
      onCheckedChange: (checked: boolean) =>
        qcReject.toggleRejectField(rejectKey, checked),
      disabled: isSaving,
    }
  }

  return (
    <div className="flex min-h-[360px] flex-1 flex-col gap-4 overflow-hidden">
      <div className="shrink-0">
        <h3 className="text-sm font-medium text-foreground">
          {t('recordDetail.documentsTitle')}
        </h3>
        {isQcRole && canManage ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {t('metadata.rejectInline.hint')}
          </p>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid gap-3">
          {fields.map((field, index) =>
            canManage && isDraftCustomField(field) ? (
              <MetadataFieldEditorRow
                key={field.name}
                field={field}
                value={coerceMetadataText(values[field.name])}
                index={index}
                disabled={isSaving}
                idPrefix="document-metadata"
                onFieldChange={(next: DataDocumentFieldT) =>
                  setFields((prev) =>
                    prev.map((item) =>
                      item.name === field.name ? next : item,
                    ),
                  )
                }
                onValueChange={(value: string) =>
                  setValues((prev) => ({ ...prev, [field.name]: value }))
                }
              />
            ) : !canManage || field.type === 'string' ? (
              <MetadataFieldRow
                key={field.name}
                field={field}
                value={coerceMetadataText(values[field.name])}
                disabled={!canManage || isSaving}
                editDisplay={false}
                onValueChange={(value) => handleChange(field.name, value)}
                onHighlight={onFieldHighlight}
                isHighlighted={highlightedFieldName === field.name}
                index={index}
                onKeyDown={canManage ? handleKeyDown : undefined}
                fieldRef={(element) => {
                  fieldRefs.current[index] = element
                }}
                rejectMark={buildFieldRejectMark(field)}
              />
            ) : (
              <MetadataFieldInput
                key={field.name}
                field={field}
                value={coerceMetadataText(values[field.name])}
                onChange={(value) => handleChange(field.name, value)}
                onHighlight={onFieldHighlight}
                isHighlighted={highlightedFieldName === field.name}
                index={index}
                idPrefix="document-metadata"
                disabled={!canManage || isSaving}
                onKeyDown={handleKeyDown}
                fieldRef={(element) => {
                  fieldRefs.current[index] = element
                }}
                rejectMark={buildFieldRejectMark(field)}
              />
            ),
          )}
        </div>
      </div>

      {canManage && isQcRole && qcReject.isRejectMode ? (
        <QcInlineRejectBar
          selectedCount={qcReject.rejectFieldKeys.size}
          notes={qcReject.rejectNotes}
          onNotesChange={qcReject.setRejectNotes}
          onClear={qcReject.clearRejectSelection}
          onSubmit={qcReject.submitReject}
          isPending={qcReject.isRejectPending}
        />
      ) : canManage ? (
        <div className="flex shrink-0 justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="default"
            className="gap-2"
            onClick={() => void handleSaveValues()}
            disabled={isSaving}
            ref={saveButtonRef}
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <ActionIcon className="size-4" aria-hidden />
            )}
            {isSaving
              ? isQcComplete
                ? t('metadata.approving')
                : t('metadata.saving')
              : actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
