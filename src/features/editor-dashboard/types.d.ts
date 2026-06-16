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

export type EditorDashboardT = {
  totalAssigned: number
  completed: number
  inProgress: number
  accuracy: EditorDashboardAccuracyT
  avgProcessingTimeSeconds: number
  completedTrend: Array<EditorDashboardCompletedPointT>
}
