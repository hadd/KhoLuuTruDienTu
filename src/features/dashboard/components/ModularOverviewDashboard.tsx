import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AdminRoleChartTypeT } from '@/features/admin-dashboard/components/AdminDashboardPage'
import { AdminDashboardPage } from '@/features/admin-dashboard/components/AdminDashboardPage'
import {
  adminDashboardOverviewQueryOptions,
  adminDossierChartQueryOptions,
  adminEmployeeKpisQueryOptions,
} from '@/features/admin-dashboard/queries'
import type { AdminDashboardDossierTrendGranularityT } from '@/features/admin-dashboard/types'
import { PersonalKpiTable } from '@/features/dashboard/components/PersonalKpiTable'
import { EditorDashboardPage } from '@/features/editor-dashboard/components/EditorDashboardPage'
import { editorDashboardQueryOptions } from '@/features/editor-dashboard/queries'
import type { EditorDashboardPeriodT } from '@/features/editor-dashboard/types'
import {
  DASHBOARD_TEAM_SECTION_KEYS,
  hasAnyOverviewDashboardSection,
  hasAnyPersonalDashboardSection,
  hasAnyTeamDashboardSection,
  isDashboardSectionVisible,
  needsEditorDashboardData,
  needsQcDashboardData,
  needsQcGroupDashboardData,
} from '@/features/permissions/lib/dashboardAccess'
import { QcDashboardPage } from '@/features/qc-dashboard/components/QcDashboardPage'
import { isQcGroupLeaderOnlyError } from '@/features/qc-dashboard/lib/loadErrors'
import {
  qcDashboardGroupQueryOptions,
  qcDashboardQueryOptions,
} from '@/features/qc-dashboard/queries'

type ModularOverviewDashboardProps = {
  permissions: Array<string>
  hidden: Array<string>
  period: EditorDashboardPeriodT
  roleChart: AdminRoleChartTypeT
  dossierTrendGranularity: AdminDashboardDossierTrendGranularityT
  groupId?: string
}

export function ModularOverviewDashboard({
  permissions,
  hidden,
  period,
  roleChart,
  dossierTrendGranularity,
  groupId,
}: ModularOverviewDashboardProps) {
  const { t } = useTranslation('common')
  const showPersonal = hasAnyPersonalDashboardSection(permissions, hidden)
  const showTeam = hasAnyTeamDashboardSection(permissions, hidden)
  const showOverview = hasAnyOverviewDashboardSection(permissions, hidden)

  const showEditor = needsEditorDashboardData(permissions, hidden)
  const showQcPersonal = needsQcDashboardData(permissions, hidden)
  const showQcGroup = needsQcGroupDashboardData(permissions, hidden)
  const showAdminTeam =
    isDashboardSectionVisible(
      permissions,
      hidden,
      DASHBOARD_TEAM_SECTION_KEYS.employeeKpis,
    ) ||
    isDashboardSectionVisible(
      permissions,
      hidden,
      DASHBOARD_TEAM_SECTION_KEYS.groupPerformance,
    )
  const showAdminOverview = hasAnyOverviewDashboardSection(permissions, hidden)

  if (!showPersonal && !showTeam && !showOverview) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-center border rounded-lg bg-card p-8">
        <div className="max-w-md space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            {t('errors.defaultTitle')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('errors.defaultDescription')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 w-full flex-1 flex-col gap-8 overflow-x-hidden">

      {showOverview && showAdminOverview ? (
        <DashboardGroup
          title={t('admin.dashboardGroups.overview', {
            defaultValue: 'Tổng quan',
          })}
        >
          <AdminSection
            roleChart={roleChart}
            dossierTrendGranularity={dossierTrendGranularity}
            permissions={permissions}
            hidden={hidden}
            groupId={groupId}
            sectionGroups={['overview']}
          />
        </DashboardGroup>
      ) : null}

      {showPersonal ? (
        <DashboardGroup
          title={t('admin.dashboardGroups.personal', {
            defaultValue: 'Cá nhân',
          })}
        >
          {showEditor ? (
            <EditorSection
              period={period}
              permissions={permissions}
              hidden={hidden}
            />
          ) : null}
          {showQcPersonal ? (
            <QcSection
              permissions={permissions}
              hidden={hidden}
              sectionGroups={['personal']}
              includeGroup={false}
            />
          ) : null}
          <PersonalKpiTable permissions={permissions} hidden={hidden} />
        </DashboardGroup>
      ) : null}

      {showTeam ? (
        <DashboardGroup
          title={t('admin.dashboardGroups.team', {
            defaultValue: 'Đội nhóm / Dự án',
          })}
        >
          {showQcGroup ? (
            <QcSection
              permissions={permissions}
              hidden={hidden}
              sectionGroups={['team']}
              includeGroup
            />
          ) : null}
          {showAdminTeam ? (
            <AdminSection
              roleChart={roleChart}
              dossierTrendGranularity={dossierTrendGranularity}
              permissions={permissions}
              hidden={hidden}
              groupId={groupId}
              sectionGroups={['team']}
            />
          ) : null}
        </DashboardGroup>
      ) : null}
    </div>
  )
}

function DashboardGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="border-b pb-2">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  )
}

function EditorSection({
  period,
  permissions,
  hidden,
}: {
  period: EditorDashboardPeriodT
  permissions: Array<string>
  hidden: Array<string>
}) {
  const { data, isLoading } = useQuery(editorDashboardQueryOptions(period))
  if (isLoading || !data) return <SectionLoading />
  return (
    <EditorDashboardPage
      data={data}
      period={period}
      permissions={permissions}
      hidden={hidden}
      embedInGroup
    />
  )
}

function QcSection({
  permissions,
  hidden,
  sectionGroups,
  includeGroup,
}: {
  permissions: Array<string>
  hidden: Array<string>
  sectionGroups: Array<'personal' | 'team'>
  includeGroup: boolean
}) {
  const overviewQuery = useQuery(qcDashboardQueryOptions())
  const groupQuery = useQuery({
    ...qcDashboardGroupQueryOptions(),
    enabled: includeGroup,
    retry: false,
  })

  if (overviewQuery.isLoading || !overviewQuery.data) {
    if (overviewQuery.isError) {
      return null
    }
    return <SectionLoading />
  }

  const groupError = includeGroup ? groupQuery.error : undefined
  const isPermissionForbidden =
    !!groupError &&
    !isQcGroupLeaderOnlyError(groupError) &&
    ((groupError as { response?: { status?: number } })?.response?.status ===
      403 ||
      (groupError as { status?: number })?.status === 403)

  return (
    <QcDashboardPage
      overview={overviewQuery.data}
      group={includeGroup && !groupError ? groupQuery.data : undefined}
      groupError={
        includeGroup && groupError && !isPermissionForbidden
          ? groupError
          : undefined
      }
      isGroupLoading={includeGroup ? groupQuery.isLoading : false}
      permissions={permissions}
      hidden={hidden}
      embedInGroup
      sectionGroups={sectionGroups}
    />
  )
}

function AdminSection({
  roleChart,
  dossierTrendGranularity,
  permissions,
  hidden,
  groupId,
  sectionGroups,
}: {
  roleChart: AdminRoleChartTypeT
  dossierTrendGranularity: AdminDashboardDossierTrendGranularityT
  permissions: Array<string>
  hidden: Array<string>
  groupId?: string
  sectionGroups: Array<'overview' | 'team'>
}) {
  const [kpiDateRange, setKpiDateRange] = useState<{
    dateFrom?: string
    dateTo?: string
  }>({})
  const [trendDateRange, setTrendDateRange] = useState<{
    dateFrom?: string
    dateTo?: string
  }>({})

  const overviewQuery = useQuery(adminDashboardOverviewQueryOptions())
  const kpiQuery = useQuery(
    adminEmployeeKpisQueryOptions(kpiDateRange.dateFrom, kpiDateRange.dateTo),
  )
  const chartQuery = useQuery(
    adminDossierChartQueryOptions(
      dossierTrendGranularity,
      trendDateRange.dateFrom,
      trendDateRange.dateTo,
    ),
  )

  if (overviewQuery.isLoading || !overviewQuery.data) return <SectionLoading />

  return (
    <AdminDashboardPage
      data={overviewQuery.data}
      employeeKpis={kpiQuery.data ?? []}
      isEmployeeKpisLoading={kpiQuery.isFetching}
      dossierChart={chartQuery.data ?? overviewQuery.data.dossierChart}
      isDossierChartLoading={chartQuery.isFetching}
      roleChart={roleChart}
      dossierTrendGranularity={dossierTrendGranularity}
      permissions={permissions}
      hidden={hidden}
      groupId={groupId}
      embedInGroup
      sectionGroups={sectionGroups}
      onKpiDateRangeChange={(dateFrom, dateTo) =>
        setKpiDateRange({ dateFrom, dateTo })
      }
      onTrendDateRangeChange={(dateFrom, dateTo) =>
        setTrendDateRange({ dateFrom, dateTo })
      }
    />
  )
}

function SectionLoading() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}
