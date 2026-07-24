import type { KeyboardEvent, RefObject } from 'react'
import type { TFunction } from 'i18next'

import { LinkDocumentBreadcrumb } from '@/features/data-management/components/LinkDocumentBreadcrumb'
import { MetadataFieldInput } from '@/features/data-management/components/MetadataFieldInput'
import { MetadataFieldRow } from '@/features/data-management/components/MetadataFieldRow'
import { coerceMetadataText } from '@/features/data-management/lib/metadataDate'
import {
  findAllDocumentsForMetadataGroup,
  getMetadataGroupDisplayName,
  resolveMetadataGroupSourceDocumentPath,
} from '@/features/data-management/lib/metadataHelpers'
import type {
  DataDocumentFieldT,
  DataMetadataGroupT,
  DataTreeNodeT,
} from '@/features/data-management/types'
import { cn } from '@/lib/utils/cn'

type PdfDoc = {
  id: string
  name: string
  filePath?: string
}

export function RecordMetadataGroupCard({
  group,
  groupIndex,
  titleOverride,
  dossierFolderHint,
  documents,
  pdfDocs,
  isActiveGroup,
  canEditFields,
  isEditorRole,
  isSaving,
  highlightedFieldKey,
  groupCardRefs,
  fieldInputRefs,
  onGroupTitleClick,
  onLinkChange,
  onFieldChange,
  onFieldActivate,
  onFieldKeyDown,
  buildFieldRejectMark,
  isEditorRejectHighlighted,
  t,
}: {
  group: DataMetadataGroupT
  groupIndex: number
  titleOverride?: string | null
  dossierFolderHint: string
  documents: Array<DataTreeNodeT>
  pdfDocs: Array<PdfDoc>
  isActiveGroup: boolean
  canEditFields: boolean
  isEditorRole: boolean
  isSaving: boolean
  highlightedFieldKey: string | null
  groupCardRefs: RefObject<Map<number, HTMLDivElement>>
  fieldInputRefs: RefObject<
    Map<string, HTMLInputElement | HTMLTextAreaElement>
  >
  onGroupTitleClick: (groupIndex: number) => void
  onLinkChange: (groupIndex: number, value: string) => void
  onFieldChange: (
    groupIndex: number,
    fieldIndex: number,
    value: string,
  ) => void
  onFieldActivate: (
    groupIndex: number,
    field: DataDocumentFieldT,
    fieldKey: string,
  ) => void
  onFieldKeyDown: (
    event: KeyboardEvent<HTMLElement>,
    groupIndex: number,
    fieldIndex: number,
    isTextArea?: boolean,
  ) => void
  buildFieldRejectMark: (
    groupCode: string,
    field: DataDocumentFieldT,
  ) =>
    | {
        id: string
        checked: boolean
        onCheckedChange: (checked: boolean) => void
        disabled: boolean
      }
    | undefined
  isEditorRejectHighlighted: (groupCode: string, fieldName: string) => boolean
  t: TFunction<'data-management'>
}) {
  const groupPath = resolveMetadataGroupSourceDocumentPath(
    group,
    dossierFolderHint,
  )
  const linkedDocuments = findAllDocumentsForMetadataGroup(group, documents)
  const currentFileName = group.source_document?.file_name
  const currentFilePath = group.source_document?.file_path
  const hasCurrentDocInList = currentFileName
    ? pdfDocs.some(
        (doc) =>
          doc.name === currentFileName ||
          (currentFilePath && doc.filePath === currentFilePath),
      )
    : false

  const selectOptions = pdfDocs.map((doc) => ({
    id: doc.id,
    name: doc.name,
    filePath: doc.filePath,
    label: doc.name,
  }))

  if (currentFileName && !hasCurrentDocInList) {
    selectOptions.unshift({
      id: 'current_missing',
      name: currentFileName,
      filePath: currentFilePath,
      label: currentFileName,
    })
  }

  const selectedOptionValue = (() => {
    if (!currentFileName) return 'none'
    const found = pdfDocs.find(
      (doc) =>
        doc.name === currentFileName ||
        (currentFilePath && doc.filePath === currentFilePath),
    )
    if (found) return found.id
    if (!hasCurrentDocInList) return 'current_missing'
    return 'none'
  })()

  const cardTitle =
    titleOverride?.trim() ||
    getMetadataGroupDisplayName(group) ||
    t('recordDetail.unknownFile')

  return (
    <div
      key={`${group.group_code}-${groupIndex}`}
      ref={(element) => {
        if (element) {
          groupCardRefs.current?.set(groupIndex, element)
        } else {
          groupCardRefs.current?.delete(groupIndex)
        }
      }}
      className={cn(
        'space-y-2 rounded-md border p-3 transition-colors',
        isActiveGroup ? 'border-primary bg-accent/30' : 'border-border',
      )}
    >
      <button
        type="button"
        className={cn(
          'text-left text-sm font-medium',
          linkedDocuments.length > 0
            ? 'cursor-pointer text-foreground hover:underline'
            : 'cursor-default text-muted-foreground',
          isActiveGroup && linkedDocuments.length > 0 && 'text-primary',
        )}
        onClick={() => onGroupTitleClick(groupIndex)}
        disabled={linkedDocuments.length === 0}
        aria-label={t('recordDetail.openPdf')}
        aria-current={isActiveGroup ? 'true' : undefined}
      >
        {cardTitle}
      </button>
      {canEditFields || isEditorRole ? (
        <div className="mt-1.5 flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            {t('recordDetail.linkFile')}
          </span>
          <LinkDocumentBreadcrumb
            folderSegments={(() => {
              const fPath = group.source_document?.file_path?.trim()
              if (fPath) {
                const segs = fPath.split(/[/\\]/).filter(Boolean)
                return segs.length > 1 ? segs.slice(0, -1) : segs
              }
              const hint = dossierFolderHint?.trim()
              if (hint) return ['raw', hint]
              return ['raw']
            })()}
            fileName={currentFileName || undefined}
            selectOptions={selectOptions}
            selectedValue={selectedOptionValue}
            onValueChange={(val) => onLinkChange(groupIndex, val)}
            disabled={isSaving || isEditorRole}
            placeholder={t('recordDetail.selectFile')}
            noDocumentLabel={t('recordDetail.noDocument')}
          />
        </div>
      ) : groupPath ? (
        <p
          className="mt-1 truncate rounded-sm bg-accent/20 px-2 py-1 font-mono text-xs text-muted-foreground"
          title={groupPath}
        >
          {groupPath}
        </p>
      ) : null}
      <div className="grid gap-2">
        {group.fields.length > 0 ? (
          group.fields.map((field, fieldIndex) => {
            const fieldKey = `${groupIndex}-${field.name}-${fieldIndex}`
            const fieldValue = coerceMetadataText(field.value)
            const isStringLike =
              field.type === 'string' || field.type === 'object'

            return !canEditFields || isStringLike ? (
              <MetadataFieldRow
                key={`${group.group_code}-${field.name}-${fieldIndex}`}
                field={field}
                value={coerceMetadataText(field.value)}
                disabled={!canEditFields || isSaving}
                editDisplay={false}
                onValueChange={(value) =>
                  onFieldChange(groupIndex, fieldIndex, value)
                }
                onHighlight={() => onFieldActivate(groupIndex, field, fieldKey)}
                isHighlighted={highlightedFieldKey === fieldKey}
                index={fieldIndex}
                onKeyDown={
                  canEditFields
                    ? (event) =>
                        onFieldKeyDown(event, groupIndex, fieldIndex)
                    : undefined
                }
                fieldRef={(element) => {
                  const refKey = `${groupIndex}-${fieldIndex}`
                  if (
                    element instanceof HTMLInputElement ||
                    element instanceof HTMLTextAreaElement
                  ) {
                    fieldInputRefs.current?.set(refKey, element)
                  } else {
                    fieldInputRefs.current?.delete(refKey)
                  }
                }}
                rejectMark={buildFieldRejectMark(group.group_code, field)}
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
                  onFieldChange(groupIndex, fieldIndex, value)
                }
                onHighlight={() => onFieldActivate(groupIndex, field, fieldKey)}
                isHighlighted={highlightedFieldKey === fieldKey}
                index={fieldIndex}
                idPrefix={`record-metadata-${groupIndex}`}
                disabled={!canEditFields || isSaving}
                onKeyDown={(event, _index, isTextArea) =>
                  onFieldKeyDown(event, groupIndex, fieldIndex, isTextArea)
                }
                fieldRef={(element) => {
                  const refKey = `${groupIndex}-${fieldIndex}`
                  if (
                    element instanceof HTMLInputElement ||
                    element instanceof HTMLTextAreaElement
                  ) {
                    fieldInputRefs.current?.set(refKey, element)
                  } else {
                    fieldInputRefs.current?.delete(refKey)
                  }
                }}
                rejectMark={buildFieldRejectMark(group.group_code, field)}
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
}
