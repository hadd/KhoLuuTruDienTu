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

export interface CreateAdminGroupQcLevelPayloadT {
  userIds: Array<string>
}

export interface CreateAdminGroupPayloadT {
  name: string
  description: string
  /** Số cấp duyệt (0–5). */
  roundNumber: number
  editorIds: Array<string>
  qcLevels: Array<CreateAdminGroupQcLevelPayloadT>
  /** Chỉ gửi khi roundNumber = 0. */
  leaderId?: string
}

export interface AvailableEditorT {
  userId: string
  email: string
  fullName: string
}

export interface AvailableEditorsResponseT {
  items: Array<AvailableEditorT>
}

export interface UpdateAdminGroupPayloadT {
  name: string
  description: string
  roundNumber: number
  editorIds: Array<string>
  /** Chỉ gửi khi roundNumber = 0. */
  leaderId?: string
  qcLevels: Array<CreateAdminGroupQcLevelPayloadT>
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
  permissionSlotCode: string | null
  createdAt: string
  expiredAt: string | null
  userProfile: AdminGroupMemberUserProfileT
}

export interface AdminGroupQcLevelT {
  level: number
  role: string
  members: Array<AdminGroupQcT>
}

export interface AdminGroupPermissionConfigSlotT {
  slotCode: string
  slotName: string
  sortOrder: number
  fieldKeys: Array<string> | string
}

export interface AdminGroupPermissionConfigTemplateT {
  id: string
  name: string
}

export interface AdminGroupPermissionConfigT {
  id: string
  name: string
  description?: string | null
  templateId: string
  status?: string
  template?: AdminGroupPermissionConfigTemplateT
  slots: Array<AdminGroupPermissionConfigSlotT>
}

export interface AdminGroupAssignmentEditorT {
  editorId: string
  fullName: string
  email: string
}

export interface AdminGroupAssignmentT {
  slotCode: string
  slotName: string
  fieldKeys: Array<string>
  editors: Array<AdminGroupAssignmentEditorT>
}

export interface AdminGroupT {
  id: string
  name: string
  description: string | null
  roundNumber: number
  dossiersPerEditor?: number | null
  metadataPermissionConfigId?: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  groupMembers?: Array<AdminGroupMemberT>
  editors: Array<AdminGroupEditorT>
  leader?: AdminGroupLeaderT
  qcs?: Array<AdminGroupQcT>
  qcLevels?: Array<AdminGroupQcLevelT>
  metadataPermissionConfig?: AdminGroupPermissionConfigT
  permissionConfig?: AdminGroupPermissionConfigT
  assignments?: Array<AdminGroupAssignmentT>
}

export interface GroupPermissionAssignmentT {
  slotCode: string
  editorIds: Array<string>
}

export interface UpdateGroupPermissionAssignmentsPayloadT {
  assignments: Array<GroupPermissionAssignmentT>
}

export interface AssignGroupMetadataPermissionConfigPayloadT {
  permissionConfigId: string
}

export interface AssignGroupByFolderPayloadT {
  folderId: string
  dossiersPerEditor?: number
  metadataPermissionConfigId?: string
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
