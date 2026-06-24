import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { Row } from '@tanstack/react-table'
import {
  CheckCircle2,
  FileSpreadsheet,
  Filter,
  Layers,
  Loader2,
  Plus,
  ScanLine,
  Timer,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DataTableRowActions } from '@/components/common/data-table/data-table-row-actions'
import { TextBlock } from '@/components/common/TextBlock'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProjectSelect } from '@/features/data-management/components/ProjectSelect'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  calculatePlanDays,
  computePlanSummaryStats,
  filterPlansByPeriod,
  formatRowIndex,
} from '@/features/plan-management/lib/planStats'
import {
  DEFAULT_PLANS_LIMIT,
  projectPlansQueryOptions,
} from '@/features/plan-management/queries'
import { PLAN_PERIODS } from '@/features/plan-management/schemas'
import { PlanCreateDialog } from '@/features/plan-management/components/PlanCreateDialog'
import { PlanDeleteDialog } from '@/features/plan-management/components/PlanDeleteDialog'
import { PlanDetailDialog } from '@/features/plan-management/components/PlanDetailDialog'
import { PlanEditDialog } from '@/features/plan-management/components/PlanEditDialog'
import { usePlanManagementProjectSelection } from '@/features/plan-management/hooks/usePlanManagementProjectSelection'
import type { PlanPeriodT, ProjectPlanT } from '@/features/plan-management/types'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { formatNumber } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

const routeApi = getRouteApi('/app/plan-management/')

function toTableRow(plan: ProjectPlanT): Row<ProjectPlanT> {
  return { original: plan } as Row<ProjectPlanT>
}

type SummaryStatCardProps = {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  iconClassName: string
}

function SummaryStatCard({
  label,
  value,
  icon: Icon,
  iconClassName,
}: SummaryStatCardProps) {
  return (
    <Card variant="bordered" className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
        </div>
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted',
            iconClassName,
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>
    </Card>
  )
}

export function PlanManagementPage() {
  const { t } = useTranslation('plan-management')
  const language = useCurrentLanguage()
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const { projectCode, handleProjectChange } = usePlanManagementProjectSelection()
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [detailPlanId, setDetailPlanId] = useState<string | null>(null)
  const [editPlanId, setEditPlanId] = useState<string | null>(null)
  const [deletePlan, setDeletePlan] = useState<ProjectPlanT | null>(null)

  const limit = search.limit ?? DEFAULT_PLANS_LIMIT
  const offset = search.offset ?? 0
  const period = search.period ?? 'all'

  const { data, isLoading, isError } = useQuery({
    ...projectPlansQueryOptions({
      projectCode: projectCode ?? '',
      limit,
      offset,
    }),
    enabled: Boolean(projectCode),
  })

  const allPlans = data?.items ?? []
  const plans = useMemo(
    () => filterPlansByPeriod(allPlans, period),
    [allPlans, period],
  )

  const stats = useMemo(() => computePlanSummaryStats(plans), [plans])

  const handlePeriodChange = (nextPeriod: PlanPeriodT) => {
    void navigate({
      to: '.',
      search: (prev) => ({
        ...prev,
        period: nextPeriod,
        offset: 0,
      }),
    })
  }

  const handleView = (plan: ProjectPlanT) => {
    setDetailPlanId(plan.id)
    setDetailOpen(true)
  }

  const handleEdit = (plan: ProjectPlanT) => {
    setEditPlanId(plan.id)
    setEditOpen(true)
  }

  const handleDelete = (plan: ProjectPlanT) => {
    setDeletePlan(plan)
    setDeleteOpen(true)
  }

  const handleComingSoon = (message: string) => {
    toast.info(message)
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!projectCode) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
              <ProjectSelect
                className="w-full min-w-[200px] sm:w-64"
                value={projectCode}
                onValueChange={handleProjectChange}
              />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
          </div>
        </div>
        <Card variant="bordered" className="flex max-w-md flex-col gap-3 p-6">
          <p className="text-sm text-muted-foreground">{t('project.selectPrompt')}</p>
        </Card>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-border bg-muted/30 p-8">
        <p className="text-sm text-muted-foreground">{t('errors.loadFailed')}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
            <ProjectSelect
              className="w-full min-w-[200px] sm:w-64"
              value={projectCode}
              onValueChange={handleProjectChange}
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleComingSoon(t('comingSoon.export'))}
          >
            <FileSpreadsheet className="size-4" />
            {t('actions.exportExcel')}
          </Button>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t('actions.addPlan')}
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-3">
        <Card variant="bordered" className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">
                {t('summary.totalEstimatedDays')}
              </p>
              <p className="mt-1 text-3xl font-semibold text-foreground">
                {t('summary.daysUnit', { count: stats.totalDays })}
              </p>
            </div>
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Timer className="size-5" />
            </div>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card variant="bordered" className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">{t('summary.filter')}</p>
                <Select value={period} onValueChange={handlePeriodChange}>
                  <SelectTrigger
                    className="mt-2 w-full"
                    aria-label={t('filter.periodLabel')}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_PERIODS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {t(`filter.periods.${item}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-blue-600">
                <Filter className="size-4" />
              </div>
            </div>
          </Card>
          <SummaryStatCard
            label={t('summary.status')}
            value={t('summary.statusAll')}
            icon={CheckCircle2}
            iconClassName="text-emerald-600"
          />
          <SummaryStatCard
            label={t('summary.pdfPages')}
            value={t('summary.pagesUnit', {
              count: formatNumber(stats.totalPdfPages, {
                locale: language === 'vi' ? 'vi-VN' : 'en-US',
                maximumFractionDigits: 0,
              }),
            })}
            icon={ScanLine}
            iconClassName="text-amber-600"
          />
          <SummaryStatCard
            label={t('summary.totalDossiers')}
            value={t('summary.dossiersUnit', {
              count: formatNumber(stats.totalDossiers, {
                locale: language === 'vi' ? 'vi-VN' : 'en-US',
                maximumFractionDigits: 0,
              }),
            })}
            icon={Layers}
            iconClassName="text-violet-600"
          />
        </div>
      </div>

      <Card variant="list" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-16">{t('table.columns.index')}</TableHead>
                <TableHead>{t('table.columns.task')}</TableHead>
                <TableHead className="text-right">
                  {t('table.columns.volume')}
                </TableHead>
                <TableHead>{t('table.columns.unit')}</TableHead>
                <TableHead className="text-right">
                  {t('table.columns.quota')}
                </TableHead>
                <TableHead className="text-right">
                  {t('table.columns.people')}
                </TableHead>
                <TableHead className="text-right">
                  {t('table.columns.days')}
                </TableHead>
                <TableHead>{t('table.columns.note')}</TableHead>
                <TableHead className="text-right">
                  {t('table.columns.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {t('empty')}
                  </TableCell>
                </TableRow>
              ) : (
                plans.map((plan, index) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-mono text-muted-foreground">
                      {formatRowIndex(index, offset)}
                    </TableCell>
                    <TableCell className="font-medium">
                      <TextBlock lines={1}>{plan.name}</TextBlock>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(plan.dossierCount, {
                        locale: language === 'vi' ? 'vi-VN' : 'en-US',
                        maximumFractionDigits: 0,
                      })}
                    </TableCell>
                    <TableCell>{t('units.dossier')}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(Number(plan.quota), {
                        locale: language === 'vi' ? 'vi-VN' : 'en-US',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      —
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {calculatePlanDays(plan.startDate, plan.endDate)}
                    </TableCell>
                    <TableCell>
                      <TextBlock lines={2} className="text-muted-foreground">
                        {plan.project.projectName}
                      </TextBlock>
                    </TableCell>
                    <TableCell>
                      <DataTableRowActions
                        row={toTableRow(plan)}
                        onEdit={() => handleEdit(plan)}
                        onDelete={() => handleDelete(plan)}
                      >
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 border-primary/30 text-primary hover:bg-primary/5"
                          onClick={() => handleView(plan)}
                        >
                          {t('actions.viewDetails')}
                        </Button>
                      </DataTableRowActions>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <PlanDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        planId={detailPlanId}
      />

      <PlanEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        planId={editPlanId}
      />

      <PlanDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        plan={deletePlan}
      />

      <PlanCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultProjectCode={projectCode}
      />
    </div>
  )
}
