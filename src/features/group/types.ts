export type DocumentStatus = 'Biên tập' | 'Chờ duyệt' | 'Duyệt' | 'Hoàn thành'

export interface GroupZoneMemberT {
  userId: string
  fullName: string
  email: string
}

export interface GroupConfigInstanceT {
  groupId: string
  useMetadataPermissionConfig?: boolean
  metadataTemplateId?: string
  metadataPermissionConfigId?: string
  slotAssignmentsBySlotCode: Record<string, Array<GroupZoneMemberT>>
}

export interface UserDocument {
  id: string
  title: string
  status: DocumentStatus
  updatedAt: string
}

export interface Member {
  id: string
  userId: string
  name: string
  email: string
  role: 'leader' | 'manager' | 'member'
  joinedAt: string
  documents: Array<UserDocument>
  permissionSlotCode?: string | null
}

export interface GroupQcMemberT {
  memberId: string
  userId: string
  name: string
  email: string
}

export interface GroupQcLevelT {
  level: number
  role: string
  members: Array<GroupQcMemberT>
}

export interface GroupPermissionSlotT {
  slotCode: string
  slotName: string
  sortOrder: number
  fieldKeys: Array<string>
}

export interface GroupPermissionConfigSummaryT {
  id: string
  name: string
  templateId: string
  template?: { id: string; name: string }
  slots: Array<GroupPermissionSlotT>
}

export interface GroupSlotAssignmentT {
  slotCode: string
  slotName: string
  fieldKeys: Array<string>
  editors: Array<{ editorId: string; fullName: string; email: string }>
}

export interface Group {
  id: string
  name: string
  description: string
  memberCount: number
  members: Array<Member>
  editorUserIds: Array<string>
  qcUserIds: Array<string>
  createdAt: string
  roundNumber?: number
  projectCode?: string | null
  dossiersPerEditor?: number | null
  metadataPermissionConfigId?: string | null
  permissionConfig?: GroupPermissionConfigSummaryT | null
  assignments?: Array<GroupSlotAssignmentT>
  qcLevels: Array<GroupQcLevelT>
}

export interface AddMemberDialogProps {
  open: boolean
  onOpenChange: (isOpen: boolean) => void
  group: Group | null
  mode?: 'add' | 'edit'
}
