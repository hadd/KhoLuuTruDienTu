import { coerceMetadataText } from '@/features/data-management/lib/metadataDate'
import type {
  DataDocumentFieldT,
  DataDossierMetadataT,
  DataMetadataEditBatchT,
  DataMetadataEditFieldChangeT,
  DataMetadataHistoryEntryT,
} from '@/features/data-management/types'

function normalizeHistoryValue(value: string | null | undefined): string {
  return coerceMetadataText(value ?? '')
}

function isMeaningfulFieldChange(
  oldValue: string | null,
  newValue: string | null,
): boolean {
  return normalizeHistoryValue(oldValue) !== normalizeHistoryValue(newValue)
}

function resolveFieldLocation(
  metadata: DataDossierMetadataT,
  fieldKey: string,
): {
  groupIndex: number
  fieldIndex: number
  field: DataDocumentFieldT
} | null {
  const dotIndex = fieldKey.indexOf('.')
  if (dotIndex <= 0) return null

  const groupCode = fieldKey.slice(0, dotIndex)
  const fieldName = fieldKey.slice(dotIndex + 1)

  for (
    let groupIndex = 0;
    groupIndex < metadata.metadata_groups.length;
    groupIndex += 1
  ) {
    const group = metadata.metadata_groups[groupIndex]
    if (group.group_code !== groupCode) continue

    for (
      let fieldIndex = 0;
      fieldIndex < group.fields.length;
      fieldIndex += 1
    ) {
      const field = group.fields[fieldIndex]
      if (field.name === fieldName) {
        return { groupIndex, fieldIndex, field }
      }
    }
  }

  return null
}

function buildFallbackField(fieldKey: string): DataDocumentFieldT {
  const dotIndex = fieldKey.indexOf('.')
  const fieldName = dotIndex >= 0 ? fieldKey.slice(dotIndex + 1) : fieldKey

  return {
    name: fieldName,
    display: fieldKey,
    type: 'string',
    value: '',
    page: 0,
    bboxes: [],
  }
}

function mapFieldChanges(
  entry: DataMetadataHistoryEntryT,
  metadata: DataDossierMetadataT,
): Array<DataMetadataEditFieldChangeT> {
  if (!entry.fieldChanges) return []

  return Object.entries(entry.fieldChanges)
    .filter(([, change]) => isMeaningfulFieldChange(change.old, change.new))
    .map(([fieldKey, change], changeIndex) => {
      const location = resolveFieldLocation(metadata, fieldKey)
      const field = location?.field ?? buildFallbackField(fieldKey)
      const groupIndex = location?.groupIndex ?? -1
      const fieldIndex = location?.fieldIndex ?? changeIndex

      return {
        id: `${entry.id}-${fieldKey}`,
        groupIndex,
        fieldIndex,
        fieldName: field.name,
        fieldDisplay: field.display || fieldKey,
        oldValue: normalizeHistoryValue(change.old),
        newValue: normalizeHistoryValue(change.new),
        field,
      }
    })
}

function resolveEditorName(entry: DataMetadataHistoryEntryT): string {
  const actorName = entry.actorName?.trim()
  if (actorName) return actorName

  const actorEmail = entry.actorEmail?.trim()
  if (actorEmail) return actorEmail

  return ''
}

/** Map BE metadata-history entries to UI edit batches. */
export function mapMetadataHistoryToBatches(
  entries: Array<DataMetadataHistoryEntryT>,
  metadata: DataDossierMetadataT,
): Array<DataMetadataEditBatchT> {
  return entries.map((entry) => ({
    id: entry.id,
    editorName: resolveEditorName(entry),
    editedAt: entry.createdAt,
    changes: mapFieldChanges(entry, metadata),
    action: entry.action,
    notes: entry.notes,
    versionNumber: entry.versionNumber,
  }))
}
