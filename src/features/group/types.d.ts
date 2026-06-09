/** Raw admin groups list — backend may omit pagination fields */
export interface AdminGroupsListResponseT {
  items: Array<AdminGroupT>
  page?: number
  limit?: number
  total?: number
  totalPages?: number
}

export interface AdminGroupEditorT {
  memberId: string
  userId: string
  email: string
  fullName: string
}

export interface AdminGroupLeaderT {
  memberId: string
  userId: string
  email: string
  fullName: string
}

export interface AdminGroupQcT extends AdminGroupEditorT {
  role?: string
}

export interface CreateAdminGroupPayloadT {
  name: string
  description: string
  roundNumber: number
  editorIds: Array<string>
  qcIds: Array<string>
}

export interface UpdateAdminGroupPayloadT {
  name: string
  description: string
  editorIds: Array<string>
  qcIds: Array<string>
}

export interface AdminGroupMemberUserProfileT {
  id: string
  email: string
  fullName: string
  avatarUrl: string | null
  phone: string | null
  address: string | null
  active: boolean
}

export interface AdminGroupMemberT {
  id: string
  groupId: string
  userId: string
  role: string
  createdAt: string
  expiredAt: string | null
  userProfile: AdminGroupMemberUserProfileT
}

export interface AdminGroupT {
  id: string
  name: string
  description: string | null
  roundNumber: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  groupMembers?: Array<AdminGroupMemberT>
  editors: Array<AdminGroupEditorT>
  leader?: AdminGroupLeaderT
  qcs?: Array<AdminGroupQcT>
}

export interface AssignGroupByFolderPayloadT {
  folderId: string
  dossiersPerEditor: number
}

export interface AssignGroupByFolderDistributionT {
  userId: string
  fullName: string
  assignedCount: number
  dossierIds: Array<string>
}

export interface AssignGroupByFolderSkippedT {
  dossierId: string
  folderId: string
  reason: string
}

export interface MetadataSchemaFieldT {
  key: string
  name: string
  display: string
}

export interface MetadataSchemaGroupT {
  groupCode: string
  groupName: string
  isDynamic: boolean
  fields: Array<MetadataSchemaFieldT>
}

export interface MetadataSchemaResponseT {
  groups: Array<MetadataSchemaGroupT>
}

export interface GroupFieldTemplateEditorT {
  editorId: string
  email: string
  fullName: string
  allowedFields: Array<string>
}

export interface GroupFieldTemplateT {
  groupId: string
  editors: Array<GroupFieldTemplateEditorT>
  isFieldSplitMode: boolean
}

export interface UpdateGroupFieldTemplatePayloadT {
  editorFieldTemplate: Array<{
    editorId: string
    allowedFields: Array<string>
  }>
}

export interface AssignGroupByFolderResponseT {
  mode: string
  group: {
    id: string
    name: string
  }
  folder: {
    id: string
    folderPath: string
    folderName: string
  }
  leafFolders: Array<{
    id: string
    parentId: string
    folderPath: string
    folderName: string
    createdAt: string
    updatedAt: string
    deletedAt: string | null
  }>
  dossiersPerEditor: number
  totalTargeted: number
  totalAssigned: number
  totalSkipped: number
  distribution: Array<AssignGroupByFolderDistributionT>
  skipped: Array<AssignGroupByFolderSkippedT>
  checkerAssignmentsCreated: number
  dossiersQcCountUpdated: number
  queueSummary: {
    queued: number
    active: number
  }
}
