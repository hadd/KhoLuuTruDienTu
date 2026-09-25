import type { AssignGroupByFolderPayloadT } from '@/features/group/types'

export function buildAssignGroupByFolderPayload(
  folderIds: Array<string>,
  dossiersPerEditor = 1,
  editorIds?: Array<string>,
): AssignGroupByFolderPayloadT {
  return {
    folderIds,
    dossiersPerEditor,
    ...(editorIds && editorIds.length > 0 ? { editorIds } : {}),
  }
}
