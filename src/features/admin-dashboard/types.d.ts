export type AdminDashboardDossierStatusT =
  | 'NEW'
  | 'OCR_PROCESSING'
  | 'OCR_FAILED'
  | 'READY_FOR_ENTRY'
  | 'ENTRY_PROCESSING'
  | 'WAITING_CHECKER_1'
  | 'CHECKER_1_PROCESSING'
  | 'CHECKER_1_REJECTED'
  | 'WAITING_CHECKER_2'
  | 'CHECKER_2_PROCESSING'
  | 'CHECKER_2_REJECTED'
  | 'WAITING_CHECKER_3'
  | 'CHECKER_3_PROCESSING'
  | 'CHECKER_3_REJECTED'
  | 'WAITING_CHECKER_4'
  | 'CHECKER_4_PROCESSING'
  | 'CHECKER_4_REJECTED'
  | 'WAITING_CHECKER_5'
  | 'CHECKER_5_PROCESSING'
  | 'CHECKER_5_REJECTED'
  | 'APPROVED'

export type AdminDashboardDossierStatusCountsT = Partial<
  Record<AdminDashboardDossierStatusT, number>
>

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
  actorName?: string | null
  createdAt: string
  description?: string | null
  groupName?: string | null
}

export type AdminDashboardSystemDossiersT = {
  total: number
  completed: number
  completionRate: number
  accuracyRate: number
}

export type AdminDashboardSystemProjectsT = {
  total: number
  completed: number
  completionRate: number
}

export type AdminDashboardOcrTrendPointT = {
  label: string
  count: number
  createdAt?: string
}

export type AdminDashboardT = {
  totalDossiers: number
  byStatus: AdminDashboardDossierStatusCountsT
  systemDossiers: AdminDashboardSystemDossiersT
  systemProjects: AdminDashboardSystemProjectsT
  totalActiveUsers: number
  totalGroups: number
  byRole: AdminDashboardRoleDistributionT
  avgProcessingTimeSeconds: number
  overallApprovalRate: number
  dossiersApprovedToday: number
  dossiersApprovedThisWeek: number
  groups: Array<AdminDashboardGroupStatsT>
  ocrActivityTrend: Array<AdminDashboardOcrTrendPointT>
  recentActivities: Array<AdminDashboardActivityT>
}
