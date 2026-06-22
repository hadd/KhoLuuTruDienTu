import type { AssignGroupByFolderPayloadT } from '@/features/group/types'

export function buildAssignGroupByFolderPayload(
  folderIds: Array<string>,
  dossiersPerEditor = 1,
): AssignGroupByFolderPayloadT {
  return {
    folderIds,
    dossiersPerEditor,
  }
}
