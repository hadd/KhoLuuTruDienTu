export type AdminDashboardRoleDistributionT = {
  admin: number
  editor: number
  qc: number
}

export type AdminDashboardGroupStatsT = {
  id?: string
  name: string
  editorCount: number
  totalDossiers: number
  approved: number
  progressRate: number
  avgEditorCorrectRate: number
  avgQcApprovalRate: number
}

export type AdminDashboardActivityT = {
  id: string
  action: string
  dossierCode: string
  createdAt: string
  description?: string | null
  groupName?: string | null
}

export type AdminDashboardOcrTrendPointT = {
  label: string
  count: number
  createdAt?: string
}

export type AdminDashboardT = {
  totalActiveUsers: number
  totalGroups: number
  byRole: AdminDashboardRoleDistributionT
  avgProcessingTimeSeconds: number
  overallApprovalRate: number
  dossiersApprovedToday: number
  groups: Array<AdminDashboardGroupStatsT>
  ocrActivityTrend: Array<AdminDashboardOcrTrendPointT>
  recentActivities: Array<AdminDashboardActivityT>
}
