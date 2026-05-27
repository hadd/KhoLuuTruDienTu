import { Check, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { MetadataFieldEditorRow } from '@/features/data-management/components/MetadataFieldStructurePanel'
import { MetadataFieldInput } from '@/features/data-management/components/MetadataFieldInput'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { getPermissionsByRole } from '@/features/data-management/config/roleConfig'
import { buildMetadataFieldValues } from '@/features/data-management/lib/metadataDate'
import {
  applyDocumentFieldsToDossierMetadata,
  buildDefaultDossierMetadata,
  createDraftCustomField,
  isDraftCustomField,
  mergeFormValuesIntoFields,
  normalizeSavedCustomFields,
} from '@/features/data-management/lib/metadataHelpers'
import {
  useClaimNextMakerAssignmentMutation,
  useSaveDossierMetadataMutation,
} from '@/features/data-management/queries'
import { isNoAssignedDossierError } from '@/features/data-management/lib/loadErrors'
import type {
  DataDocumentFieldT,
  DataDossierMetadataT,
} from '@/features/data-management/types'

export function DocumentMetadataForm({
  dossierId,
  dossierMetadata,
  documentName,
  documentFileRef,
  fields: initialFields,
  role,
  isLastDocument = false,
  onAdvance,
  onFieldHighlight,
  highlightedFieldName,
}: {
  dossierId: string
  dossierMetadata?: DataDossierMetadataT
  documentName: string
  documentFileRef: string
  fields: Array<DataDocumentFieldT>
  role: string
  isLastDocument?: boolean
  onAdvance?: () => void
  onFieldHighlight?: (field: DataDocumentFieldT) => void
  highlightedFieldName?: string | null
}) {
  const { t } = useTranslation('data-management')
  const permissions = getPermissionsByRole(role as DataManagementRole)
  const canManage = permissions.canEditFileMetadataFields
  const saveMutation = useSaveDossierMetadataMutation(role as DataManagementRole)
  const claimNextMutation = useClaimNextMakerAssignmentMutation()
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

  async function handleSaveValues() {
    try {
      const updatedFields = buildUpdatedFields()
      const metadata = buildUpdatedMetadata()
      await saveMutation.mutateAsync({ dossierId, metadata })
      setFields(updatedFields)
      setValues(buildMetadataFieldValues(updatedFields))

      if (role === 'editor' && isLastDocument) {
        await claimNextMutation.mutateAsync()
        toast.success(t('metadata.completeSuccess'))
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
    const target = fieldRefs.current[index] as HTMLTextAreaElement | HTMLInputElement
    if (!target) return
    target.focus()
    try {
      if (target.type === 'text' || target.type === 'textarea') {
        const end = target.value.length
        target.setSelectionRange(end, end)
      }
    } catch {
      // ignore
    }
  }

  function focusNext(index: number) {
    if (index >= fields.length - 1) {
      saveButtonRef.current?.focus()
      return
    }
    focusField(index + 1)
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLElement>,
    index: number,
    isTextArea: boolean = false,
  ) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      focusNext(index)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusNext(index)
      return
    }

    if (isTextArea && event.key === 'ArrowUp') {
      event.preventDefault()
      focusField(Math.max(index - 1, 0))
    }
  }

  const isSaving = saveMutation.isPending || claimNextMutation.isPending
  const isEditorComplete = role === 'editor' && isLastDocument
  const actionLabel =
    role === 'qc'
      ? t('metadata.approve')
      : isEditorComplete
        ? t('metadata.complete')
        : t('metadata.save')
  const ActionIcon = isEditorComplete ? Check : Save

  return (
    <div className="flex min-h-[360px] flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">
          {t('recordDetail.documentsTitle')}
        </h3>
        {canManage ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleAddField}
            disabled={isSaving}
          >
            <Plus className="size-4" aria-hidden />
            {t('recordDetail.addField')}
          </Button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid gap-3">
          {fields.map((field, index) =>
            canManage && isDraftCustomField(field) ? (
              <MetadataFieldEditorRow
                key={field.name}
                field={field}
                value={values[field.name] ?? ''}
                index={index}
                disabled={isSaving}
                idPrefix="document-metadata"
                onFieldChange={(next: DataDocumentFieldT) =>
                  setFields((prev) =>
                    prev.map((item) => (item.name === field.name ? next : item)),
                  )
                }
                onValueChange={(value: string) =>
                  setValues((prev) => ({ ...prev, [field.name]: value }))
                }
                onDelete={() => handleDeleteField(field.name)}
              />
            ) : (
              <MetadataFieldInput
                key={field.name}
                field={field}
                value={values[field.name] ?? ''}
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
                trailingAction={
                  canManage ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteField(field.name)}
                      disabled={isSaving}
                      aria-label={t('recordDetail.deleteField')}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  ) : undefined
                }
              />
            ),
          )}
        </div>
      </div>

      {canManage ? (
        <div className="flex shrink-0 justify-end pt-2">
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
            {isSaving ? t('metadata.saving') : actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
