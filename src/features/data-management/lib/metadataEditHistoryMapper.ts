import { coerceMetadataText } from '@/features/data-management/lib/metadataDate'
import { findAllDocumentsForMetadataGroup } from '@/features/data-management/lib/metadataHelpers'
import type {
  DataDocumentFieldT,
  DataDossierMetadataT,
  DataMetadataEditBatchT,
  DataMetadataEditFieldChangeT,
  DataMetadataHistoryEntryT,
  DataMetadataHistoryFileRefT,
  DataTreeNodeT,
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

function collectChangedGroupIndices(
  entry: DataMetadataHistoryEntryT,
  metadata: DataDossierMetadataT,
): Array<number> {
  if (!entry.fieldChanges) return []

  const indices: Array<number> = []
  const seen = new Set<number>()

  for (const fieldKey of Object.keys(entry.fieldChanges)) {
    const location = resolveFieldLocation(metadata, fieldKey)
    if (location) {
      if (!seen.has(location.groupIndex)) {
        seen.add(location.groupIndex)
        indices.push(location.groupIndex)
      }
      continue
    }

    const dotIndex = fieldKey.indexOf('.')
    if (dotIndex <= 0) continue
    const groupCode = fieldKey.slice(0, dotIndex)
    const groupIndex = metadata.metadata_groups.findIndex(
      (group) => group.group_code === groupCode,
    )
    if (groupIndex < 0 || seen.has(groupIndex)) continue
    seen.add(groupIndex)
    indices.push(groupIndex)
  }

  return indices
}

function addHistoryFile(
  files: Array<DataMetadataHistoryFileRefT>,
  seen: Set<string>,
  file: DataMetadataHistoryFileRefT,
) {
  const key = file.documentId ?? `name:${file.fileName}:${file.groupIndex}`
  if (!file.fileName.trim() && !file.documentId) return
  if (seen.has(key)) return
  seen.add(key)
  files.push(file)
}

function resolveHistoryFiles(
  entry: DataMetadataHistoryEntryT,
  metadata: DataDossierMetadataT,
  documents: Array<DataTreeNodeT>,
): Array<DataMetadataHistoryFileRefT> {
  const files: Array<DataMetadataHistoryFileRefT> = []
  const seen = new Set<string>()
  const groupIndices = collectChangedGroupIndices(entry, metadata)

  function addFromGroup(groupIndex: number) {
    const group = metadata.metadata_groups[groupIndex]
    if (!group) return

    const matchedDocuments = findAllDocumentsForMetadataGroup(group, documents)
    const sourceFileName = group.source_document?.file_name?.trim() ?? ''

    if (matchedDocuments.length > 0) {
      for (const document of matchedDocuments) {
        addHistoryFile(files, seen, {
          documentId: document.id,
          fileName: sourceFileName || document.name.trim(),
          groupIndex,
        })
      }
      return
    }

    if (sourceFileName) {
      addHistoryFile(files, seen, {
        documentId: null,
        fileName: sourceFileName,
        groupIndex,
      })
    }
  }

  if (groupIndices.length > 0) {
    groupIndices.forEach(addFromGroup)
    return files
  }

  if (documents.length === 1) {
    addHistoryFile(files, seen, {
      documentId: documents[0].id,
      fileName: documents[0].name.trim(),
      groupIndex: 0,
    })
  }

  return files
}

/** Map BE metadata-history entries to UI edit batches. */
export function mapMetadataHistoryToBatches(
  entries: Array<DataMetadataHistoryEntryT>,
  metadata: DataDossierMetadataT,
  documents: Array<DataTreeNodeT> = [],
): Array<DataMetadataEditBatchT> {
  return entries.map((entry) => ({
    id: entry.id,
    editorName: resolveEditorName(entry),
    editedAt: entry.createdAt,
    changes: mapFieldChanges(entry, metadata),
    files: resolveHistoryFiles(entry, metadata, documents),
    action: entry.action,
    notes: entry.notes,
    versionNumber: entry.versionNumber,
  }))
}
