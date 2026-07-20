import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  ArrowLeft,
  FileText,
  FolderKanban,
  Gauge,
  Loader2,
  Pencil,
  Plus,
  Save,
  Timer,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePlanAccess } from '@/features/plan-management/hooks/usePlanAccess'
import {
  paperSizesQueryOptions,
  projectPlanDetailsQueryOptions,
  projectPlanQueryOptions,
  useUpdateProjectPlanDetails,
} from '@/features/plan-management/queries'
import type { ProjectPlanDetailItemT } from '@/features/plan-management/types'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { cn } from '@/lib/utils/cn'
import { formatNumber } from '@/lib/utils/format'

const routeApi = getRouteApi('/app/plan-management/$planId')

interface EditableTaskRow {
  rowKey: string
  taskName: string
  quantity: number
  unit: string
  quota: number
  dateCount: number
  workerCount: number
}

function toEditableTaskRow(item: ProjectPlanDetailItemT): EditableTaskRow {
  return {
    rowKey: item.id,
    taskName: item.taskName,
    quantity: item.quantity,
    unit: item.unit,
    quota: item.quota,
    dateCount: item.dateCount,
    workerCount: item.workerCount,
  }
}

function createEmptyTaskRow(seed = Date.now()): EditableTaskRow {
  return {
    rowKey: `new-${seed}`,
    taskName: '',
    quantity: 0,
    unit: '',
    quota: 0,
    dateCount: 0,
    workerCount: 0,
  }
}

export function PlanDetailPage() {
  const { t } = useTranslation('plan-management')
  const language = useCurrentLanguage()
  const { planId } = routeApi.useParams()
  const navigate = routeApi.useNavigate()
  const search = routeApi.useSearch()

  const numberLocale = language === 'vi' ? 'vi-VN' : 'en-US'

  const {
    data: plan,
    isLoading: isPlanLoading,
    isError: isPlanError,
  } = useQuery(projectPlanQueryOptions(planId))

  const {
    data: detailItems = [],
    isLoading: isDetailsLoading,
    isError: isDetailsError,
  } = useQuery(projectPlanDetailsQueryOptions(planId))

  const { data: paperSizesData } = useQuery(paperSizesQueryOptions())

  const paperSizeMap = new Map(
    (paperSizesData?.items ?? []).map((ps) => [ps.id, ps.name]),
  )

  const updatePlanDetails = useUpdateProjectPlanDetails()
  const { canUpdateProjectPlans } = usePlanAccess()
  const [taskRows, setTaskRows] = useState<Array<EditableTaskRow>>([])
  const [isEditing, setIsEditing] = useState(false)

  const isLoading = isPlanLoading || isDetailsLoading
  const isError = isPlanError || isDetailsError
  const isSaving = updatePlanDetails.isPending

  useEffect(() => {
    setTaskRows(
      detailItems.length > 0 ? detailItems.map(toEditableTaskRow) : [],
    )
    setIsEditing(false)
  }, [detailItems])

  const handleStartEditing = () => {
    setTaskRows((prev) => (prev.length > 0 ? prev : [createEmptyTaskRow()]))
    setIsEditing(true)
  }

  const handleCancelEditing = () => {
    setTaskRows(
      detailItems.length > 0 ? detailItems.map(toEditableTaskRow) : [],
    )
    setIsEditing(false)
  }

  const handleBack = () => {
    void navigate({
      to: '/app/plan-management',
      search,
    })
  }

  const handleAddTask = () => {
    setTaskRows((prev) => [...prev, createEmptyTaskRow()])
  }

  const handleRemoveTask = (rowKey: string) => {
    setTaskRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((row) => row.rowKey !== rowKey),
    )
  }

  const updateTaskRow = (
    rowKey: string,
    patch: Partial<Omit<EditableTaskRow, 'rowKey'>>,
  ) => {
    setTaskRows((prev) =>
      prev.map((row) => (row.rowKey === rowKey ? { ...row, ...patch } : row)),
    )
  }

  const handleSaveTasks = async () => {
    const sanitizedRows = taskRows
      .map((row) => ({
        taskName: row.taskName.trim(),
        quantity: row.quantity,
        unit: row.unit.trim(),
        quota: row.quota,
        dateCount: row.dateCount,
        workerCount: row.workerCount,
      }))
      .filter(
        (row) =>
          row.taskName ||
          row.unit ||
          row.quantity > 0 ||
          row.quota > 0 ||
          row.dateCount > 0 ||
          row.workerCount > 0,
      )

    await updatePlanDetails.mutateAsync({
      planId,
      payload: {
        details: sanitizedRows,
      },
    })
    setIsEditing(false)
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError || !plan) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20">
        <p className="text-sm text-muted-foreground">{t('errors.detailFailed')}</p>
        <Button type="button" variant="outline" onClick={handleBack}>
          {t('detail.back')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 items-center gap-2.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          onClick={handleBack}
          aria-label={t('detail.back')}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-foreground">
            {plan.name}
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            {t('detail.title')}
          </p>
        </div>
      </div>

      <Card variant="detail" className="shrink-0 p-4">
        <div className="space-y-3">
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <FolderKanban className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">
              <span className="font-medium text-foreground">
                {t('detail.summary.project')}:
              </span>{' '}
              {plan.project.projectName}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <SummaryStat
              icon={Gauge}
              label={t('detail.summary.totalDossiers')}
              value={formatNumber(plan.dossierCount, {
                locale: numberLocale,
                maximumFractionDigits: 0,
              })}
            />
            <SummaryStat
              icon={FileText}
              label={t('detail.summary.totalPages')}
              value={formatNumber(plan.pageTotal, {
                locale: numberLocale,
                maximumFractionDigits: 0,
              })}
            />
            <SummaryStat
              icon={Timer}
              label={t('detail.summary.totalDuration')}
              value={t('units.days', { count: plan.dateCount })}
            />
          </div>

          {plan.paperPlans.length > 0 ? (
            <div className="border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">
                {t('detail.paperPlans.title')}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {plan.paperPlans.map((pp) => (
                  <span
                    key={pp.paperSizeId}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-sm"
                  >
                    <span className="font-semibold text-foreground">
                      {paperSizeMap.get(pp.paperSizeId) ??
                        t('detail.paperPlans.unknown')}
                    </span>
                    <span className="text-muted-foreground">—</span>
                    <span className="tabular-nums text-foreground">
                      {formatNumber(pp.quantity, {
                        locale: numberLocale,
                        maximumFractionDigits: 0,
                      })}{' '}
                      {t('detail.paperPlans.quantityUnit')}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      <Card variant="list" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <h2 className="text-sm font-semibold text-foreground">
            {t('detail.tasks.title')}
          </h2>
          {canUpdateProjectPlans ? (
            <div className="flex flex-wrap items-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEditing}
                    disabled={isSaving}
                  >
                    {t('form.actions.cancel')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddTask}
                    disabled={isSaving}
                  >
                    <Plus className="size-4" />
                    {t('detail.actions.addTask')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveTasks}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    {isSaving ? t('detail.actions.saving') : t('detail.actions.save')}
                  </Button>
                </>
              ) : (
                <Button type="button" size="sm" onClick={handleStartEditing}>
                  <Pencil className="size-4" />
                  {t('actions.edit')}
                </Button>
              )}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <Table className="w-full min-w-[760px] table-fixed">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[8%]" />
            </colgroup>
            <TableHeader className="sticky top-0 z-10 bg-muted/50 [&_th]:bg-muted/50 [&_th]:text-center">
              <TableRow className="hover:bg-muted/50">
                <TableHead>{t('detail.table.columns.taskName')}</TableHead>
                <TableHead>{t('detail.table.columns.quantity')}</TableHead>
                <TableHead>{t('detail.table.columns.quota')}</TableHead>
                <TableHead>{t('detail.table.columns.workerCount')}</TableHead>
                <TableHead>{t('detail.table.columns.unit')}</TableHead>
                <TableHead>{t('detail.table.columns.duration')}</TableHead>
                <TableHead>
                  {isEditing ? t('detail.table.columns.actions') : null}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_td]:text-center">
              {taskRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-muted-foreground"
                  >
                    {t('detail.emptyTasks')}
                  </TableCell>
                </TableRow>
              ) : (
                taskRows.map((item) => (
                  <TableRow key={item.rowKey}>
                    <TableCell className="align-middle">
                      {isEditing ? (
                        <Input
                          value={item.taskName}
                          placeholder={t('detail.form.taskName.placeholder')}
                          className="h-9 text-center"
                          onChange={(event) =>
                            updateTaskRow(item.rowKey, {
                              taskName: event.target.value,
                            })
                          }
                        />
                      ) : (
                        <span className="font-medium">
                          {item.taskName || '—'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="align-middle tabular-nums">
                      {isEditing ? (
                        <Input
                          type="text"
                          inputMode="numeric"
                          className="h-9 text-center"
                          value={item.quantity === 0 ? '' : String(item.quantity)}
                          placeholder={t('detail.form.quantity.placeholder')}
                          onChange={(event) => {
                            const nextRaw = event.target.value.replace(/[^0-9]/g, '')
                            updateTaskRow(item.rowKey, {
                              quantity: nextRaw ? Number(nextRaw) : 0,
                            })
                          }}
                        />
                      ) : (
                        formatNumber(item.quantity, {
                          locale: numberLocale,
                          maximumFractionDigits: 0,
                        })
                      )}
                    </TableCell>
                    <TableCell className="align-middle tabular-nums">
                      {isEditing ? (
                        <Input
                          type="text"
                          inputMode="numeric"
                          className="h-9 text-center"
                          value={item.quota === 0 ? '' : String(item.quota)}
                          placeholder={t('detail.form.quota.placeholder')}
                          onChange={(event) => {
                            const nextRaw = event.target.value.replace(/[^0-9]/g, '')
                            updateTaskRow(item.rowKey, {
                              quota: nextRaw ? Number(nextRaw) : 0,
                            })
                          }}
                        />
                      ) : (
                        formatNumber(item.quota, {
                          locale: numberLocale,
                          maximumFractionDigits: 0,
                        })
                      )}
                    </TableCell>
                    <TableCell className="align-middle tabular-nums">
                      {isEditing ? (
                        <Input
                          type="text"
                          inputMode="numeric"
                          className="h-9 text-center"
                          value={
                            item.workerCount === 0 ? '' : String(item.workerCount)
                          }
                          placeholder={t('detail.form.workerCount.placeholder')}
                          onChange={(event) => {
                            const nextRaw = event.target.value.replace(/[^0-9]/g, '')
                            updateTaskRow(item.rowKey, {
                              workerCount: nextRaw ? Number(nextRaw) : 0,
                            })
                          }}
                        />
                      ) : (
                        formatNumber(item.workerCount, {
                          locale: numberLocale,
                          maximumFractionDigits: 0,
                        })
                      )}
                    </TableCell>
                    <TableCell className="align-middle">
                      {isEditing ? (
                        <Input
                          value={item.unit}
                          className="h-9 text-center"
                          placeholder={t('detail.form.unit.placeholder')}
                          onChange={(event) =>
                            updateTaskRow(item.rowKey, { unit: event.target.value })
                          }
                        />
                      ) : (
                        item.unit || '—'
                      )}
                    </TableCell>
                    <TableCell className="align-middle tabular-nums">
                      {isEditing ? (
                        <Input
                          type="text"
                          inputMode="numeric"
                          className="h-9 text-center"
                          value={item.dateCount === 0 ? '' : String(item.dateCount)}
                          placeholder={t('detail.form.dateCount.placeholder')}
                          onChange={(event) => {
                            const nextRaw = event.target.value.replace(/[^0-9]/g, '')
                            updateTaskRow(item.rowKey, {
                              dateCount: nextRaw ? Number(nextRaw) : 0,
                            })
                          }}
                        />
                      ) : (
                        t('units.days', { count: item.dateCount })
                      )}
                    </TableCell>
                    <TableCell className="align-middle">
                      {isEditing ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'size-9 text-destructive hover:text-destructive',
                            taskRows.length <= 1 && 'invisible',
                          )}
                          disabled={taskRows.length <= 1}
                          onClick={() => handleRemoveTask(item.rowKey)}
                          aria-label={t('detail.actions.removeTask')}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}

function SummaryStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-foreground">
          {value}
        </p>
      </div>
    </div>
  )
}
