import type {
  AdminDashboardDossierChartT,
  AdminDashboardDossierTrendGranularityT,
  AdminDashboardEmployeeKpiT,
  AdminDashboardT,
  AdminDashboardWorkloadStatsT,
  AdminDashboardWorkloadVolumeT,
} from '@/features/admin-dashboard/types'
import { apiClient } from '@/lib/api/apiClient'
import type { SingleResourceResponse } from '@/types/api'

type AdminDashboardOverviewRawT = {
  totalDossiers?: number
  byStatus?: AdminDashboardT['byStatus']
  totalActiveUsers?: number
  totalGroups?: number
  byRole?: Partial<AdminDashboardT['byRole']>
}

type AdminDashboardPerformanceRawT = {
  avgProcessingTimeSeconds?: number
  overallApprovalRate?: number
  dossiersApprovedToday?: number
  dossiersApprovedThisWeek?: number
}

type AdminDashboardGroupRawT = Partial<AdminDashboardT['groups'][number]> & {
  groupId?: string
  groupName?: string
  groupCode?: string
}

type AdminDashboardActivityRawT = Partial<
  AdminDashboardT['recentActivities'][number]
> & {
  dossierId?: string
  dossierName?: string
  actorName?: string
}

type AdminDashboardOcrTrendRawT = Partial<
  AdminDashboardT['ocrActivityTrend'][number]
> & {
  bucket?: string
  time?: string
}

type AdminDashboardSystemDossiersRawT = Partial<
  AdminDashboardT['systemDossiers']
>
type AdminDashboardSystemProjectsRawT = Partial<
  AdminDashboardT['systemProjects']
>
type AdminDashboardDossierChartPointRawT = Partial<
  AdminDashboardT['dossierChart']['points'][number]
>
type AdminDashboardDossierChartRawT = Partial<
  AdminDashboardT['dossierChart']
> & {
  points?: Array<AdminDashboardDossierChartPointRawT>
}

type AdminDashboardEmployeeKpiRawT = Partial<AdminDashboardEmployeeKpiT> & {
  id?: string
  name?: string
  userFullName?: string
  avgProcessingTimeSeconds?: number
}

type AdminDashboardWorkloadVolumeRawT = Partial<AdminDashboardWorkloadVolumeT>
type AdminDashboardWorkloadStatsRawT = Partial<{
  total: AdminDashboardWorkloadVolumeRawT
  unentered: AdminDashboardWorkloadVolumeRawT
  unassigned: AdminDashboardWorkloadVolumeRawT
  completed: AdminDashboardWorkloadVolumeRawT
  error: AdminDashboardWorkloadVolumeRawT
}>

type AdminDashboardRawT = Partial<AdminDashboardT> & {
  overview?: AdminDashboardOverviewRawT
  systemDossiers?: AdminDashboardSystemDossiersRawT
  systemProjects?: AdminDashboardSystemProjectsRawT
  workloadStats?: AdminDashboardWorkloadStatsRawT
  dossierChart?: AdminDashboardDossierChartRawT
  performance?: AdminDashboardPerformanceRawT
  groups?: Array<AdminDashboardGroupRawT>
  recentActivities?: Array<AdminDashboardActivityRawT>
  recentActivity?: Array<AdminDashboardActivityRawT>
  ocrActivityTrend?: Array<AdminDashboardOcrTrendRawT>
  ocrActivity?: Array<AdminDashboardOcrTrendRawT>
  employeeKpis?: Array<AdminDashboardEmployeeKpiRawT>
  userKpis?: Array<AdminDashboardEmployeeKpiRawT>
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

function normalizeGroup(
  group: AdminDashboardGroupRawT,
): AdminDashboardT['groups'][number] {
  return {
    id: group.id ?? group.groupId,
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
    actorName: activity.actorName ?? null,
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

function normalizeEmployeeKpi(
  item: AdminDashboardEmployeeKpiRawT,
  index: number,
): AdminDashboardEmployeeKpiT {
  const assignedDossiersCount = item.assignedDossiersCount ?? 0
  const completedDossiersCount = item.completedDossiersCount ?? 0
  const assignedPagesCount = item.assignedPagesCount ?? 0
  const completedPagesCount = item.completedPagesCount ?? 0
  const assignedFilesCount = item.assignedFilesCount ?? 0
  const completedFilesCount = item.completedFilesCount ?? 0

  const dossierCompletionRate =
    item.dossierCompletionRate ??
    (assignedDossiersCount > 0
      ? Math.round((completedDossiersCount / assignedDossiersCount) * 1000) / 10
      : 0)

  const pageCompletionRate =
    item.pageCompletionRate ??
    (assignedPagesCount > 0
      ? Math.round((completedPagesCount / assignedPagesCount) * 1000) / 10
      : 0)

  const fileCompletionRate =
    item.fileCompletionRate ??
    (assignedFilesCount > 0
      ? Math.round((completedFilesCount / assignedFilesCount) * 1000) / 10
      : 0)

  const accuracyRate = item.accuracyRate ?? 95
  const rejectedDossiersCount = item.rejectedDossiersCount ?? 0
  const avgProcessingTimeMinutes =
    item.avgProcessingTimeMinutes ??
    Math.round((item.avgProcessingTimeSeconds ?? 900) / 60)

  let kpiStatus: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'CRITICAL' = 'GOOD'
  if (accuracyRate >= 95 && dossierCompletionRate >= 90) {
    kpiStatus = 'EXCELLENT'
  } else if (accuracyRate >= 80 && dossierCompletionRate >= 80) {
    kpiStatus = 'GOOD'
  } else if (accuracyRate >= 70 || dossierCompletionRate >= 70) {
    kpiStatus = 'WARNING'
  } else {
    kpiStatus = 'CRITICAL'
  }

  const role = item.role ?? 'editor'
  const isEditor = role === 'editor'
  const isQc = role === 'qc' || role.startsWith('qc')

  const makerAssignedDossiersCount = item.makerAssignedDossiersCount ?? (isEditor ? assignedDossiersCount : 0)
  const makerCompletedDossiersCount = item.makerCompletedDossiersCount ?? (isEditor ? completedDossiersCount : 0)
  const makerAssignedPagesCount = item.makerAssignedPagesCount ?? (isEditor ? assignedPagesCount : 0)
  const makerCompletedPagesCount = item.makerCompletedPagesCount ?? (isEditor ? completedPagesCount : 0)
  const makerAssignedFilesCount = item.makerAssignedFilesCount ?? (isEditor ? assignedFilesCount : 0)
  const makerCompletedFilesCount = item.makerCompletedFilesCount ?? (isEditor ? completedFilesCount : 0)
  const makerDossierCompletionRate = item.makerDossierCompletionRate ?? (makerAssignedDossiersCount > 0 ? Math.round((makerCompletedDossiersCount / makerAssignedDossiersCount) * 1000) / 10 : 0)
  const makerPageCompletionRate = item.makerPageCompletionRate ?? (makerAssignedPagesCount > 0 ? Math.round((makerCompletedPagesCount / makerAssignedPagesCount) * 1000) / 10 : 0)
  const makerFileCompletionRate = item.makerFileCompletionRate ?? (makerAssignedFilesCount > 0 ? Math.round((makerCompletedFilesCount / makerAssignedFilesCount) * 1000) / 10 : 0)

  const qcAssignedDossiersCount = item.qcAssignedDossiersCount ?? (isQc ? assignedDossiersCount : 0)
  const qcCompletedDossiersCount = item.qcCompletedDossiersCount ?? (isQc ? completedDossiersCount : 0)
  const qcAssignedPagesCount = item.qcAssignedPagesCount ?? (isQc ? assignedPagesCount : 0)
  const qcCompletedPagesCount = item.qcCompletedPagesCount ?? (isQc ? completedPagesCount : 0)
  const qcAssignedFilesCount = item.qcAssignedFilesCount ?? (isQc ? assignedFilesCount : 0)
  const qcCompletedFilesCount = item.qcCompletedFilesCount ?? (isQc ? completedFilesCount : 0)
  const qcDossierCompletionRate = item.qcDossierCompletionRate ?? (qcAssignedDossiersCount > 0 ? Math.round((qcCompletedDossiersCount / qcAssignedDossiersCount) * 1000) / 10 : 0)
  const qcPageCompletionRate = item.qcPageCompletionRate ?? (qcAssignedPagesCount > 0 ? Math.round((qcCompletedPagesCount / qcAssignedPagesCount) * 1000) / 10 : 0)
  const qcFileCompletionRate = item.qcFileCompletionRate ?? (qcAssignedFilesCount > 0 ? Math.round((qcCompletedFilesCount / qcAssignedFilesCount) * 1000) / 10 : 0)

  return {
    userId: item.userId ?? item.id ?? `user-${index + 1}`,
    fullName:
      item.fullName ?? item.userFullName ?? item.name ?? `Nhân sự ${index + 1}`,
    role,
    groupName: item.groupName ?? null,
    groupId: item.groupId ?? null,
    assignedDossiersCount,
    completedDossiersCount,
    rejectedDossiersCount,
    assignedPagesCount,
    completedPagesCount,
    assignedFilesCount,
    completedFilesCount,
    dossierCompletionRate,
    pageCompletionRate,
    fileCompletionRate,
    makerAssignedDossiersCount,
    makerCompletedDossiersCount,
    makerAssignedPagesCount,
    makerCompletedPagesCount,
    makerAssignedFilesCount,
    makerCompletedFilesCount,
    makerDossierCompletionRate,
    makerPageCompletionRate,
    makerFileCompletionRate,
    qcAssignedDossiersCount,
    qcCompletedDossiersCount,
    qcAssignedPagesCount,
    qcCompletedPagesCount,
    qcAssignedFilesCount,
    qcCompletedFilesCount,
    qcDossierCompletionRate,
    qcPageCompletionRate,
    qcFileCompletionRate,
    accuracyRate,
    avgProcessingTimeMinutes,
    kpiStatus: item.kpiStatus ?? kpiStatus,
  }
}

function normalizeWorkloadVolume(
  raw?: AdminDashboardWorkloadVolumeRawT,
): AdminDashboardWorkloadVolumeT {
  return {
    dossiers: raw?.dossiers ?? 0,
    files: raw?.files ?? 0,
    pages: raw?.pages ?? 0,
  }
}

function normalizeWorkloadStats(
  raw?: AdminDashboardWorkloadStatsRawT,
): AdminDashboardWorkloadStatsT {
  return {
    total: normalizeWorkloadVolume(raw?.total),
    unentered: normalizeWorkloadVolume(raw?.unentered),
    unassigned: normalizeWorkloadVolume(raw?.unassigned),
    completed: normalizeWorkloadVolume(raw?.completed),
    error: normalizeWorkloadVolume(raw?.error),
  }
}

function normalizeSystemDossiers(
  raw: AdminDashboardSystemDossiersRawT | undefined,
  fallbackTotal: number,
): AdminDashboardT['systemDossiers'] {
  return {
    total: raw?.total ?? fallbackTotal,
    completed: raw?.completed ?? 0,
    completionRate: raw?.completionRate ?? 0,
    accuracyRate: raw?.accuracyRate ?? 0,
  }
}

function normalizeSystemProjects(
  raw: AdminDashboardSystemProjectsRawT | undefined,
): AdminDashboardT['systemProjects'] {
  return {
    total: raw?.total ?? 0,
    completed: raw?.completed ?? 0,
    completionRate: raw?.completionRate ?? 0,
  }
}

function normalizeDossierChartPoint(
  point: AdminDashboardDossierChartPointRawT,
): AdminDashboardT['dossierChart']['points'][number] {
  return {
    period: point.period ?? '',
    editedCompleted: point.editedCompleted ?? 0,
    fullyCompleted: point.fullyCompleted ?? 0,
  }
}

function normalizeDossierChart(
  raw: AdminDashboardDossierChartRawT | undefined,
): AdminDashboardT['dossierChart'] {
  return {
    granularity: raw?.granularity ?? 'month',
    rangeStart: raw?.rangeStart ?? '',
    rangeEnd: raw?.rangeEnd ?? '',
    points: (raw?.points ?? []).map(normalizeDossierChartPoint),
  }
}

function normalizeDashboard(raw: AdminDashboardRawT): AdminDashboardT {
  const overview = raw.overview
  const performance = raw.performance
  const recentActivities = raw.recentActivities ?? raw.recentActivity ?? []
  const ocrActivityTrend = raw.ocrActivityTrend ?? raw.ocrActivity ?? []
  const totalDossiers = raw.totalDossiers ?? overview?.totalDossiers ?? 0
  const rawEmployeeKpis = raw.employeeKpis ?? raw.userKpis

  return {
    totalDossiers,
    byStatus: raw.byStatus ?? overview?.byStatus ?? {},
    systemDossiers: normalizeSystemDossiers(raw.systemDossiers, totalDossiers),
    systemProjects: normalizeSystemProjects(raw.systemProjects),
    workloadStats: normalizeWorkloadStats(raw.workloadStats),
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
    dossiersApprovedThisWeek:
      raw.dossiersApprovedThisWeek ??
      performance?.dossiersApprovedThisWeek ??
      0,
    groups: (raw.groups ?? []).map(normalizeGroup),
    dossierChart: normalizeDossierChart(raw.dossierChart),
    ocrActivityTrend: ocrActivityTrend.map(normalizeOcrTrendPoint),
    recentActivities: recentActivities.map(normalizeActivity),
    employeeKpis: rawEmployeeKpis ? rawEmployeeKpis.map(normalizeEmployeeKpi) : [],
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
  >('/api/v1/admin/dashboard/', {
    timeout: 90_000,
  })

  return normalizeDashboard(unwrapDashboardResponse(response.data))
}

export const getAdminEmployeeKpis = async (params?: {
  dateFrom?: string
  dateTo?: string
}): Promise<Array<AdminDashboardEmployeeKpiT>> => {
  const response = await apiClient.get<
    | { employeeKpis?: Array<AdminDashboardEmployeeKpiRawT> }
    | SingleResourceResponse<{ employeeKpis?: Array<AdminDashboardEmployeeKpiRawT> }>
  >('/api/v1/admin/dashboard/employee-kpis', {
    timeout: 90_000,
    params: {
      ...(params?.dateFrom ? { dateFrom: params.dateFrom } : {}),
      ...(params?.dateTo ? { dateTo: params.dateTo } : {}),
    },
  })

  const payload = response.data
  const raw =
    typeof payload === 'object' &&
    payload !== null &&
    'record' in payload
      ? (payload as SingleResourceResponse<{ employeeKpis?: Array<AdminDashboardEmployeeKpiRawT> }>).record
      : (payload as { employeeKpis?: Array<AdminDashboardEmployeeKpiRawT> })

  return (raw.employeeKpis ?? []).map(normalizeEmployeeKpi)
}

export const getAdminDossierChart = async (params?: {
  dossierTrendGranularity?: AdminDashboardDossierTrendGranularityT
  dateFrom?: string
  dateTo?: string
}): Promise<AdminDashboardDossierChartT> => {
  const response = await apiClient.get<
    AdminDashboardDossierChartRawT | SingleResourceResponse<AdminDashboardDossierChartRawT>
  >('/api/v1/admin/dashboard/dossier-chart', {
    timeout: 90_000,
    params: {
      chartGranularity: params?.dossierTrendGranularity ?? 'month',
      ...(params?.dateFrom ? { dateFrom: params.dateFrom } : {}),
      ...(params?.dateTo ? { dateTo: params.dateTo } : {}),
    },
  })

  const raw =
    typeof response.data === 'object' &&
    response.data !== null &&
    'record' in response.data
      ? (response.data as SingleResourceResponse<AdminDashboardDossierChartRawT>).record
      : (response.data as AdminDashboardDossierChartRawT)

  return normalizeDossierChart(raw)
}
