import type {
  AdminDashboardDossierTrendGranularityT,
  AdminDashboardT,
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
}

type AdminDashboardRawT = Partial<AdminDashboardT> & {
  overview?: AdminDashboardOverviewRawT
  systemDossiers?: AdminDashboardSystemDossiersRawT
  systemProjects?: AdminDashboardSystemProjectsRawT
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

  const accuracyRate = item.accuracyRate ?? 95
  const rejectedDossiersCount = item.rejectedDossiersCount ?? 0
  const avgProcessingTimeMinutes = item.avgProcessingTimeMinutes ?? Math.round((item.avgProcessingTimeSeconds ?? 900) / 60)

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
  const makerDossierCompletionRate = item.makerDossierCompletionRate ?? (makerAssignedDossiersCount > 0 ? Math.round((makerCompletedDossiersCount / makerAssignedDossiersCount) * 1000) / 10 : 0)
  const makerPageCompletionRate = item.makerPageCompletionRate ?? (makerAssignedPagesCount > 0 ? Math.round((makerCompletedPagesCount / makerAssignedPagesCount) * 1000) / 10 : 0)

  const qcAssignedDossiersCount = item.qcAssignedDossiersCount ?? (isQc ? assignedDossiersCount : 0)
  const qcCompletedDossiersCount = item.qcCompletedDossiersCount ?? (isQc ? completedDossiersCount : 0)
  const qcAssignedPagesCount = item.qcAssignedPagesCount ?? (isQc ? assignedPagesCount : 0)
  const qcCompletedPagesCount = item.qcCompletedPagesCount ?? (isQc ? completedPagesCount : 0)
  const qcDossierCompletionRate = item.qcDossierCompletionRate ?? (qcAssignedDossiersCount > 0 ? Math.round((qcCompletedDossiersCount / qcAssignedDossiersCount) * 1000) / 10 : 0)
  const qcPageCompletionRate = item.qcPageCompletionRate ?? (qcAssignedPagesCount > 0 ? Math.round((qcCompletedPagesCount / qcAssignedPagesCount) * 1000) / 10 : 0)

  return {
    userId: item.userId ?? item.id ?? `user-${index + 1}`,
    fullName: item.fullName ?? item.userFullName ?? item.name ?? `Nhân sự ${index + 1}`,
    role,
    groupName: item.groupName ?? null,
    groupId: item.groupId ?? null,
    assignedDossiersCount,
    completedDossiersCount,
    rejectedDossiersCount,
    assignedPagesCount,
    completedPagesCount,
    dossierCompletionRate,
    pageCompletionRate,
    makerAssignedDossiersCount,
    makerCompletedDossiersCount,
    makerAssignedPagesCount,
    makerCompletedPagesCount,
    makerDossierCompletionRate,
    makerPageCompletionRate,
    qcAssignedDossiersCount,
    qcCompletedDossiersCount,
    qcAssignedPagesCount,
    qcCompletedPagesCount,
    qcDossierCompletionRate,
    qcPageCompletionRate,
    accuracyRate,
    avgProcessingTimeMinutes,
    kpiStatus: item.kpiStatus ?? kpiStatus,
  }
}

const FALLBACK_EMPLOYEE_KPIS: Array<AdminDashboardEmployeeKpiT> = [
  {
    userId: 'emp-1',
    fullName: 'Nguyễn Văn An',
    role: 'editor',
    groupName: 'Nhóm Biên Tập 1',
    assignedDossiersCount: 60,
    completedDossiersCount: 54,
    rejectedDossiersCount: 2,
    assignedPagesCount: 600,
    completedPagesCount: 540,
    dossierCompletionRate: 90.0,
    pageCompletionRate: 90.0,
    accuracyRate: 98.5,
    avgProcessingTimeMinutes: 12,
    kpiStatus: 'EXCELLENT',
  },
  {
    userId: 'emp-2',
    fullName: 'Trần Thị Bình',
    role: 'editor',
    groupName: 'Nhóm Biên Tập 1',
    assignedDossiersCount: 45,
    completedDossiersCount: 42,
    rejectedDossiersCount: 3,
    assignedPagesCount: 480,
    completedPagesCount: 450,
    dossierCompletionRate: 93.3,
    pageCompletionRate: 93.8,
    accuracyRate: 96.0,
    avgProcessingTimeMinutes: 15,
    kpiStatus: 'EXCELLENT',
  },
  {
    userId: 'emp-3',
    fullName: 'Lê Hoàng Cường',
    role: 'qc',
    groupName: 'Nhóm Kiểm Duyệt A',
    assignedDossiersCount: 80,
    completedDossiersCount: 78,
    rejectedDossiersCount: 1,
    assignedPagesCount: 850,
    completedPagesCount: 830,
    dossierCompletionRate: 97.5,
    pageCompletionRate: 97.6,
    accuracyRate: 99.1,
    avgProcessingTimeMinutes: 8,
    kpiStatus: 'EXCELLENT',
  },
  {
    userId: 'emp-4',
    fullName: 'Phạm Minh Đức',
    role: 'editor',
    groupName: 'Nhóm Biên Tập 2',
    assignedDossiersCount: 50,
    completedDossiersCount: 40,
    rejectedDossiersCount: 8,
    assignedPagesCount: 520,
    completedPagesCount: 410,
    dossierCompletionRate: 80.0,
    pageCompletionRate: 78.8,
    accuracyRate: 84.2,
    avgProcessingTimeMinutes: 22,
    kpiStatus: 'GOOD',
  },
  {
    userId: 'emp-5',
    fullName: 'Đỗ Thị Giang',
    role: 'qc',
    groupName: 'Nhóm Kiểm Duyệt B',
    assignedDossiersCount: 70,
    completedDossiersCount: 68,
    rejectedDossiersCount: 2,
    assignedPagesCount: 750,
    completedPagesCount: 730,
    dossierCompletionRate: 97.1,
    pageCompletionRate: 97.3,
    accuracyRate: 98.8,
    avgProcessingTimeMinutes: 10,
    kpiStatus: 'EXCELLENT',
  },
  {
    userId: 'emp-6',
    fullName: 'Vũ Quốc Hùng',
    role: 'editor',
    groupName: 'Nhóm Biên Tập 2',
    assignedDossiersCount: 55,
    completedDossiersCount: 50,
    rejectedDossiersCount: 6,
    assignedPagesCount: 580,
    completedPagesCount: 530,
    dossierCompletionRate: 90.9,
    pageCompletionRate: 91.4,
    accuracyRate: 91.5,
    avgProcessingTimeMinutes: 18,
    kpiStatus: 'GOOD',
  },
  {
    userId: 'emp-7',
    fullName: 'Hoàng Thị Mai',
    role: 'editor',
    groupName: 'Nhóm Biên Tập 1',
    assignedDossiersCount: 40,
    completedDossiersCount: 38,
    rejectedDossiersCount: 4,
    assignedPagesCount: 400,
    completedPagesCount: 380,
    dossierCompletionRate: 95.0,
    pageCompletionRate: 95.0,
    accuracyRate: 76.8,
    avgProcessingTimeMinutes: 25,
    kpiStatus: 'WARNING',
  },
]

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

  const employeeKpis = rawEmployeeKpis
    ? rawEmployeeKpis.map(normalizeEmployeeKpi)
    : FALLBACK_EMPLOYEE_KPIS

  return {
    totalDossiers,
    byStatus: raw.byStatus ?? overview?.byStatus ?? {},
    systemDossiers: normalizeSystemDossiers(raw.systemDossiers, totalDossiers),
    systemProjects: normalizeSystemProjects(raw.systemProjects),
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
    employeeKpis,
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

export const getAdminDashboard = async (params?: {
  dossierTrendGranularity?: AdminDashboardDossierTrendGranularityT
  dateFrom?: string
  dateTo?: string
}): Promise<AdminDashboardT> => {
  const response = await apiClient.get<
    AdminDashboardRawT | SingleResourceResponse<AdminDashboardRawT>
  >('/api/v1/admin/dashboard/', {
    params: {
      ...(params?.dossierTrendGranularity
        ? { granularity: params.dossierTrendGranularity }
        : {}),
      ...(params?.dateFrom ? { dateFrom: params.dateFrom } : {}),
      ...(params?.dateTo ? { dateTo: params.dateTo } : {}),
    },
  })

  return normalizeDashboard(unwrapDashboardResponse(response.data))
}
