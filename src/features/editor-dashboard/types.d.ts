export type EditorDashboardAccuracyT = {
  correct: number
  incorrect: number
  rate: number
}

export type EditorDashboardCompletedPointT = {
  label: string
  count: number
}

export type EditorDashboardPeriodT = '7d' | '30d' | '90d' | '12m'

export type EditorDashboardVolumeT = {
  dossiers: number
  files: number
  pages: number
}

export type EditorDashboardT = {
  totalAssigned: EditorDashboardVolumeT
  completed: EditorDashboardVolumeT
  inProgress: EditorDashboardVolumeT
  accuracy: EditorDashboardAccuracyT
  avgProcessingTimeSeconds: number
  completedTrend: Array<EditorDashboardCompletedPointT>
}
