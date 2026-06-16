import type {
  EditorDashboardCompletedPointT,
  EditorDashboardPeriodT,
  EditorDashboardT,
} from '@/features/editor-dashboard/types'
import { apiClient } from '@/lib/api/apiClient'
import type { SingleResourceResponse } from '@/types/api'

type EditorDashboardRawT = Partial<EditorDashboardT> & {
  completedTrend?: Array<Partial<EditorDashboardCompletedPointT>>
  completedByPeriod?: Array<Partial<EditorDashboardCompletedPointT>>
  workloadTrend?: Array<Partial<EditorDashboardCompletedPointT>>
}

function isRecordWrapper<T>(
  data: T | SingleResourceResponse<T>,
): data is SingleResourceResponse<T> {
  return typeof data === 'object' && data !== null && 'record' in data
}

function unwrapResponse<T>(data: T | SingleResourceResponse<T>): T {
  if (isRecordWrapper(data)) {
    return data.record
  }

  return data
}

function normalizeCompletedTrend(
  points?: Array<Partial<EditorDashboardCompletedPointT>>,
): Array<EditorDashboardCompletedPointT> {
  return (points ?? []).map((point, index) => ({
    label: point.label ?? `#${index + 1}`,
    count: point.count ?? 0,
  }))
}

function normalizeDashboard(raw: EditorDashboardRawT): EditorDashboardT {
  const completedTrend = normalizeCompletedTrend(
    raw.completedTrend ?? raw.completedByPeriod ?? raw.workloadTrend,
  )

  return {
    totalAssigned: raw.totalAssigned ?? 0,
    completed: raw.completed ?? 0,
    inProgress: raw.inProgress ?? 0,
    accuracy: {
      correct: raw.accuracy?.correct ?? 0,
      incorrect: raw.accuracy?.incorrect ?? 0,
      rate: raw.accuracy?.rate ?? 0,
    },
    avgProcessingTimeSeconds: raw.avgProcessingTimeSeconds ?? 0,
    completedTrend,
  }
}

export const getEditorDashboard = async (
  period: EditorDashboardPeriodT = '30d',
): Promise<EditorDashboardT> => {
  const response = await apiClient.get<
    EditorDashboardRawT | SingleResourceResponse<EditorDashboardRawT>
  >('/api/v1/dashboard/editor', {
    params: { period },
  })

  return normalizeDashboard(unwrapResponse(response.data))
}
