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
