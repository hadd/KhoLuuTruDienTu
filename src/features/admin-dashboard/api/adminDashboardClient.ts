import type { AdminDashboardT } from '@/features/admin-dashboard/types'
import { apiClient } from '@/lib/api/apiClient'
import type { SingleResourceResponse } from '@/types/api'

type AdminDashboardOverviewRawT = {
  totalActiveUsers?: number
  totalGroups?: number
  byRole?: Partial<AdminDashboardT['byRole']>
}

type AdminDashboardPerformanceRawT = {
  avgProcessingTimeSeconds?: number
  overallApprovalRate?: number
  dossiersApprovedToday?: number
}

type AdminDashboardGroupRawT = Partial<AdminDashboardT['groups'][number]> & {
  groupName?: string
  groupCode?: string
}

type AdminDashboardActivityRawT = Partial<AdminDashboardT['recentActivities'][number]> & {
  dossierId?: string
  dossierName?: string
}

type AdminDashboardOcrTrendRawT = Partial<AdminDashboardT['ocrActivityTrend'][number]> & {
  bucket?: string
  time?: string
}

type AdminDashboardRawT = Partial<AdminDashboardT> & {
  overview?: AdminDashboardOverviewRawT
  performance?: AdminDashboardPerformanceRawT
  groups?: Array<AdminDashboardGroupRawT>
  recentActivities?: Array<AdminDashboardActivityRawT>
  recentActivity?: Array<AdminDashboardActivityRawT>
  ocrActivityTrend?: Array<AdminDashboardOcrTrendRawT>
  ocrActivity?: Array<AdminDashboardOcrTrendRawT>
}

function isDashboardRecordWrapper(
  data: AdminDashboardRawT | SingleResourceResponse<AdminDashboardRawT>,
): data is SingleResourceResponse<AdminDashboardRawT> {
  return typeof data === 'object' && data !== null && 'record' in data
}

function normalizeByRole(
  byRole?: Partial<AdminDashboardT['byRole']>,
): AdminDashboardT['byRole'] {
  return {
    admin: byRole?.admin ?? 0,
    editor: byRole?.editor ?? 0,
    qc: byRole?.qc ?? 0,
  }
}

function normalizeGroup(group: AdminDashboardGroupRawT): AdminDashboardT['groups'][number] {
  return {
    id: group.id,
    name: group.name ?? group.groupName ?? group.groupCode ?? '-',
    editorCount: group.editorCount ?? 0,
    totalDossiers: group.totalDossiers ?? 0,
    approved: group.approved ?? 0,
    progressRate: group.progressRate ?? 0,
    avgEditorCorrectRate: group.avgEditorCorrectRate ?? 0,
    avgQcApprovalRate: group.avgQcApprovalRate ?? 0,
  }
}

function normalizeActivity(
  activity: AdminDashboardActivityRawT,
  index: number,
): AdminDashboardT['recentActivities'][number] {
  return {
    id: activity.id ?? `activity-${index}`,
    action: activity.action ?? 'UNKNOWN',
    dossierCode:
      activity.dossierCode ?? activity.dossierName ?? activity.dossierId ?? '-',
    createdAt: activity.createdAt ?? new Date().toISOString(),
    description: activity.description ?? null,
    groupName: activity.groupName ?? null,
  }
}

function normalizeOcrTrendPoint(
  point: AdminDashboardOcrTrendRawT,
  index: number,
): AdminDashboardT['ocrActivityTrend'][number] {
  return {
    label: point.label ?? point.bucket ?? point.time ?? `#${index + 1}`,
    count: point.count ?? 0,
    createdAt: point.createdAt,
  }
}

function normalizeDashboard(raw: AdminDashboardRawT): AdminDashboardT {
  const overview = raw.overview
  const performance = raw.performance
  const recentActivities =
    raw.recentActivities ?? raw.recentActivity ?? []
  const ocrActivityTrend = raw.ocrActivityTrend ?? raw.ocrActivity ?? []

  return {
    totalActiveUsers: raw.totalActiveUsers ?? overview?.totalActiveUsers ?? 0,
    totalGroups: raw.totalGroups ?? overview?.totalGroups ?? 0,
    byRole: normalizeByRole(raw.byRole ?? overview?.byRole),
    avgProcessingTimeSeconds:
      raw.avgProcessingTimeSeconds ??
      performance?.avgProcessingTimeSeconds ??
      0,
    overallApprovalRate:
      raw.overallApprovalRate ?? performance?.overallApprovalRate ?? 0,
    dossiersApprovedToday:
      raw.dossiersApprovedToday ?? performance?.dossiersApprovedToday ?? 0,
    groups: (raw.groups ?? []).map(normalizeGroup),
    ocrActivityTrend: ocrActivityTrend.map(normalizeOcrTrendPoint),
    recentActivities: recentActivities.map(normalizeActivity),
  }
}

function unwrapDashboardResponse(
  data: AdminDashboardRawT | SingleResourceResponse<AdminDashboardRawT>,
): AdminDashboardRawT {
  if (isDashboardRecordWrapper(data)) {
    return data.record
  }

  return data
}

export const getAdminDashboard = async (): Promise<AdminDashboardT> => {
  const response = await apiClient.get<
    AdminDashboardRawT | SingleResourceResponse<AdminDashboardRawT>
  >('/api/v1/admin/dashboard/')

  return normalizeDashboard(unwrapDashboardResponse(response.data))
}
