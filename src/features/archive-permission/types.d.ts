export type ArchivePermissionConfigStatusT = 'draft' | 'ready' | 'close'

export interface ArchivePermissionSlotT {
  id?: string
  configId?: string
  slotCode: string
  slotName: string
  sortOrder: number
  permissionKeys: Array<string>
  fondIds: Array<string>
}

export interface ArchivePermissionConfigListItemT {
  id: string
  name: string
  description: string | null
  status: ArchivePermissionConfigStatusT
  createdAt: string
  updatedAt: string
  slots: Array<ArchivePermissionSlotT>
}

export interface ArchivePermissionConfigOptionT {
  id: string
  name: string
  description: string | null
}

export interface CreateArchivePermissionConfigPayloadT {
  name: string
  description?: string | null
}

export interface UpdateArchivePermissionConfigPayloadT {
  name?: string
  description?: string | null
  status?: ArchivePermissionConfigStatusT
  slots?: Array<ArchivePermissionSlotT>
}

export interface ArchiveGroupBindingT {
  id: string
  groupId: string
  configId: string
  fondIds: Array<string>
  createdAt?: string
  updatedAt?: string
  config?: {
    id: string
    name: string
    status: ArchivePermissionConfigStatusT
  } | null
}

export interface ArchiveUserAssignmentT {
  id: string
  userId: string
  configId: string
  configName: string | null
  slotCode: string
  fondIds: Array<string>
  assignedAt: string
}

export interface ReplaceArchiveUserAssignmentsPayloadT {
  assignments: Array<{
    configId: string
    slotCode: string
    fondIds: Array<string>
  }>
}

export interface UpsertArchiveGroupBindingPayloadT {
  configId: string
  fondIds?: Array<string>
}
