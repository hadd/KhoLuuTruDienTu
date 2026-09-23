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
  documentRef?: string
} | null {
  const parts = fieldKey.split('.')
  if (parts.length < 2) return null

  const groupCode = parts[0]
  const fieldName = parts[parts.length - 1]
  // Extract document ref from middle parts (handles file names with dots)
  const documentRef = parts.length > 2 ? parts.slice(1, -1).join('.') : undefined

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
        return { groupIndex, fieldIndex, field, documentRef }
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
      const documentRef = location?.documentRef

      return {
        id: `${entry.id}-${fieldKey}`,
        groupIndex,
        fieldIndex,
        fieldName: field.name,
        fieldDisplay: field.display || fieldKey,
        oldValue: normalizeHistoryValue(change.old),
        newValue: normalizeHistoryValue(change.new),
        field,
        ...(documentRef ? { documentRef } : {}),
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
  allChanges: Array<DataMetadataEditFieldChangeT>,
): {
  files: Array<DataMetadataHistoryFileRefT>
  dossierLevelChanges: Array<DataMetadataEditFieldChangeT>
} {
  const files: Array<DataMetadataHistoryFileRefT> = []
  const seen = new Set<string>()
  const usedChangeIds = new Set<string>()
  
  // Group changes by document reference
  const changesByDocument = new Map<string | null, Array<DataMetadataEditFieldChangeT>>()
  
  for (const change of allChanges) {
    const docRef = change.documentRef ?? null
    if (!changesByDocument.has(docRef)) {
      changesByDocument.set(docRef, [])
    }
    changesByDocument.get(docRef)!.push(change)
  }
  
  // Process document-level changes
  for (const [docRef, docChanges] of changesByDocument.entries()) {
    if (docRef === null) {
      // These are group-level changes without document reference (old format)
      // Handle with group-based logic but distribute changes carefully
      const groupIndices = collectChangedGroupIndices(entry, metadata)
      
      for (const groupIndex of groupIndices) {
        const group = metadata.metadata_groups[groupIndex]
        if (!group) continue
        
        const matchedDocuments = findAllDocumentsForMetadataGroup(group, documents)
        const sourceFileName = group.source_document?.file_name?.trim() ?? ''
        const groupChanges = docChanges.filter((change) => change.groupIndex === groupIndex)
        
        if (matchedDocuments.length > 0) {
          // For old format without document ref, create entries for each matched document
          // but mark as potentially inaccurate
          for (const document of matchedDocuments) {
            const file: DataMetadataHistoryFileRefT = {
              documentId: document.id,
              fileName: document.name.trim() || sourceFileName,
              groupIndex,
              fileChanges: groupChanges,
            }
            addHistoryFile(files, seen, file)
          }
          groupChanges.forEach((change) => usedChangeIds.add(change.id))
        } else if (sourceFileName) {
          addHistoryFile(files, seen, {
            documentId: null,
            fileName: sourceFileName,
            groupIndex,
            fileChanges: groupChanges,
          })
          groupChanges.forEach((change) => usedChangeIds.add(change.id))
        }
      }
    } else {
      // These are document-specific changes (new format)
      // Find the matching document in the tree
      const matchedDocument = documents.find(doc => 
        doc.name.includes(docRef) || 
        doc.filePath?.includes(docRef) ||
        doc.fileUrl?.includes(docRef)
      )
      
      if (matchedDocument) {
        const groupIndex = docChanges[0]?.groupIndex ?? 0
        const file: DataMetadataHistoryFileRefT = {
          documentId: matchedDocument.id,
          fileName: matchedDocument.name.trim(),
          groupIndex,
          fileChanges: docChanges,
        }
        addHistoryFile(files, seen, file)
        docChanges.forEach((change) => usedChangeIds.add(change.id))
      } else {
        // Fallback: create a file entry even if we can't match it to a tree document
        const groupIndex = docChanges[0]?.groupIndex ?? 0
        addHistoryFile(files, seen, {
          documentId: null,
          fileName: docRef,
          groupIndex,
          fileChanges: docChanges,
        })
        docChanges.forEach((change) => usedChangeIds.add(change.id))
      }
    }
  }
  
  // Fallback for when no changes were processed
  if (files.length === 0 && allChanges.length > 0) {
    const groupIndices = collectChangedGroupIndices(entry, metadata)
    
    if (groupIndices.length > 0) {
      for (const groupIndex of groupIndices) {
        const group = metadata.metadata_groups[groupIndex]
        if (!group) continue
        
        const matchedDocuments = findAllDocumentsForMetadataGroup(group, documents)
        const sourceFileName = group.source_document?.file_name?.trim() ?? ''
        const groupChanges = allChanges.filter((change) => change.groupIndex === groupIndex)
        
        if (matchedDocuments.length > 0) {
          for (const document of matchedDocuments) {
            const file: DataMetadataHistoryFileRefT = {
              documentId: document.id,
              fileName: document.name.trim() || sourceFileName,
              groupIndex,
              fileChanges: groupChanges,
            }
            addHistoryFile(files, seen, file)
          }
          groupChanges.forEach((change) => usedChangeIds.add(change.id))
        } else if (sourceFileName) {
          addHistoryFile(files, seen, {
            documentId: null,
            fileName: sourceFileName,
            groupIndex,
            fileChanges: groupChanges,
          })
          groupChanges.forEach((change) => usedChangeIds.add(change.id))
        }
      }
    } else if (documents.length === 1) {
      allChanges.forEach((change) => usedChangeIds.add(change.id))
      addHistoryFile(files, seen, {
        documentId: documents[0].id,
        fileName: documents[0].name.trim(),
        groupIndex: 0,
        fileChanges: allChanges,
      })
    }
  }

  const dossierLevelChanges = allChanges.filter((change) => !usedChangeIds.has(change.id))

  return { files, dossierLevelChanges }
}

/** Map BE metadata-history entries to UI edit batches. */
export function mapMetadataHistoryToBatches(
  entries: Array<DataMetadataHistoryEntryT>,
  metadata: DataDossierMetadataT,
  documents: Array<DataTreeNodeT> = [],
): Array<DataMetadataEditBatchT> {
  return entries.map((entry) => {
    const allChanges = mapFieldChanges(entry, metadata)
    const { files, dossierLevelChanges } = resolveHistoryFiles(
      entry,
      metadata,
      documents,
      allChanges,
    )
    return {
      id: entry.id,
      editorName: resolveEditorName(entry),
      editedAt: entry.createdAt,
      changes: allChanges,
      files,
      dossierLevelChanges,
      action: entry.action,
      notes: entry.notes,
      versionNumber: entry.versionNumber,
    }
  })
}
