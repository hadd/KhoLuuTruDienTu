import type {
  QcDashboardActivityPointT,
  QcDashboardGroupT,
  QcDashboardT,
} from '@/features/qc-dashboard/types'
import { apiClient } from '@/lib/api/apiClient'
import type { SingleResourceResponse } from '@/types/api'

type QcDashboardRawT = Partial<QcDashboardT>
type QcDashboardGroupRawT = Partial<QcDashboardGroupT> & {
  processingTrend?: Array<Partial<QcDashboardActivityPointT>>
  processingByDay?: Array<Partial<QcDashboardActivityPointT>>
  dailyActivity?: Array<Partial<QcDashboardActivityPointT>>
  activityTrend?: Array<Partial<QcDashboardActivityPointT>>
}

function normalizeProcessingTrend(
  points?: Array<Partial<QcDashboardActivityPointT>>,
): Array<QcDashboardActivityPointT> {
  return (points ?? []).map((point, index) => ({
    label: point.label ?? `#${index + 1}`,
    date: point.date,
    count: point.count ?? 0,
  }))
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

function normalizeOverview(raw: QcDashboardRawT): QcDashboardT {
  return {
    totalAssigned: raw.totalAssigned ?? 0,
    approved: raw.approved ?? 0,
    rejected: raw.rejected ?? 0,
    reviewed: raw.reviewed ?? 0,
    pending: raw.pending ?? 0,
    efficiency: {
      approvalRate: raw.efficiency?.approvalRate ?? 0,
      rejectionRate: raw.efficiency?.rejectionRate ?? 0,
    },
    byStep: (raw.byStep ?? []).map((item) => ({
      step: item.step ?? 0,
      role: item.role ?? 'CHECKER_1',
      approved: item.approved ?? 0,
      rejected: item.rejected ?? 0,
      pending: item.pending ?? 0,
    })),
  }
}

function normalizeGroup(raw: QcDashboardGroupRawT): QcDashboardGroupT {
  return {
    groupId: raw.groupId ?? '',
    groupName: raw.groupName ?? '-',
    totalDossiers: raw.totalDossiers ?? 0,
    approved: raw.approved ?? 0,
    inProgress: raw.inProgress ?? 0,
    progressRate: raw.progressRate ?? 0,
    editors: (raw.editors ?? []).map((editor) => ({
      userId: editor.userId ?? '',
      fullName: editor.fullName ?? '-',
      completed: editor.completed ?? 0,
      inProgress: editor.inProgress ?? 0,
      correctRate: editor.correctRate ?? 0,
      avgProcessingTimeSeconds: editor.avgProcessingTimeSeconds ?? 0,
    })),
    qcMembers: (raw.qcMembers ?? []).map((member) => ({
      userId: member.userId ?? '',
      fullName: member.fullName ?? '-',
      role: member.role ?? 'CHECKER_1',
      reviewed: member.reviewed ?? 0,
      approved: member.approved ?? 0,
      approvalRate: member.approvalRate ?? 0,
    })),
    processingTrend: normalizeProcessingTrend(
      raw.processingTrend ??
        raw.processingByDay ??
        raw.dailyActivity ??
        raw.activityTrend,
    ),
  }
}

export const getQcDashboard = async (): Promise<QcDashboardT> => {
  const response = await apiClient.get<
    QcDashboardRawT | SingleResourceResponse<QcDashboardRawT>
  >('/api/v1/dashboard/qc')

  return normalizeOverview(unwrapResponse(response.data))
}

export const getQcDashboardGroup = async (): Promise<QcDashboardGroupT> => {
  const response = await apiClient.get<
    QcDashboardGroupRawT | SingleResourceResponse<QcDashboardGroupRawT>
  >('/api/v1/dashboard/qc/group', {
    _skipGlobalErrorToast: true,
  })

  return normalizeGroup(unwrapResponse(response.data))
}
