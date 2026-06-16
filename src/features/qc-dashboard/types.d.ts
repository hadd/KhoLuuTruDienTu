export type QcCheckerRoleT =
  | 'CHECKER_1'
  | 'CHECKER_2'
  | 'CHECKER_3'
  | 'CHECKER_4'
  | 'CHECKER_5'

export type QcDashboardStepStatsT = {
  step: number
  role: QcCheckerRoleT
  approved: number
  rejected: number
  pending: number
}

export type QcDashboardEfficiencyT = {
  approvalRate: number
  rejectionRate: number
}

export type QcDashboardT = {
  totalAssigned: number
  approved: number
  rejected: number
  reviewed: number
  pending: number
  efficiency: QcDashboardEfficiencyT
  byStep: Array<QcDashboardStepStatsT>
}

export type QcDashboardGroupEditorT = {
  userId: string
  fullName: string
  completed: number
  inProgress: number
  correctRate: number
  avgProcessingTimeSeconds: number
}

export type QcDashboardGroupMemberT = {
  userId: string
  fullName: string
  role: QcCheckerRoleT
  reviewed: number
  approved: number
  approvalRate: number
}

export type QcDashboardGroupT = {
  groupId: string
  groupName: string
  totalDossiers: number
  approved: number
  inProgress: number
  progressRate: number
  editors: Array<QcDashboardGroupEditorT>
  qcMembers: Array<QcDashboardGroupMemberT>
}
