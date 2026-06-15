import type { AssignGroupByFolderPayloadT } from '@/features/group/types'

export function buildAssignGroupByFolderPayload(
  folderId: string,
  dossiersPerEditor = 1,
): AssignGroupByFolderPayloadT {
  return {
    folderId,
    dossiersPerEditor,
  }
}
