export type BorrowApprovalClearanceItemT = {
  id: string
  roleId: string
  roleName: string
  maxSecurityLevelId: string
  maxSecurityLevelName: string
  maxLevelOrder: number
}

export type BorrowApprovalClearanceRoleOptionT = {
  id: string
  name: string
}

export type BorrowApprovalClearanceLevelOptionT = {
  id: string
  name: string
  levelOrder: number
}

export type BorrowApprovalClearanceCatalogT = {
  items: Array<BorrowApprovalClearanceItemT>
  roles: Array<BorrowApprovalClearanceRoleOptionT>
  securityLevels: Array<BorrowApprovalClearanceLevelOptionT>
}

export type ReplaceBorrowApprovalClearancesPayloadT = {
  items: Array<{
    roleId: string
    maxSecurityLevelId: string
  }>
}

export type BorrowApprovalClearanceDraftRowT = {
  key: string
  roleId: string
  maxSecurityLevelId: string
}
